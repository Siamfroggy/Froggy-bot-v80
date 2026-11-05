"use strict";

/**
 * AMINUL-SARDAR-FCA safety layer.
 *
 * - getThreadInfo: cache + safe fallback (never returns null / missing adminIDs)
 * - sendMessage: sequential queue with random delay between messages
 * - cookie validation (c_user, xs, datr) with clear messages
 * - appState file backup
 * - clearer error explanations + built-in diagnostics (api.juwelDiag)
 *
 * Settings live in the bot's config.json:  { "FCAOption": { "juwel": { ... } } }
 * Nothing here changes the shape of what the original functions return.
 */

const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  sendQueue: { enabled: true, minDelayMs: 2000, maxDelayMs: 2000, maxQueue: 500, taskTimeoutMs: 60000 },
  threadInfo: { fallback: true, cacheTtlMs: 300000, timeoutMs: 8000 },
  loginRetry: { enabled: true, delaysMin: [1, 2, 5, 10] },
  appStateBackup: { enabled: true, file: "appstate.backup.json", intervalMin: 30 },
  logging: true,
};

const REQUIRED_COOKIES = ["c_user", "xs"];
const WANTED_COOKIES = ["c_user", "xs", "datr"];

function merge(base, extra) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if (!extra || typeof extra !== "object") return out;
  for (const k of Object.keys(extra)) {
    const v = extra[k];
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = merge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function loadSettings(extra) {
  let cfg = merge(DEFAULTS, {});
  const files = [path.join(process.cwd(), "config.json")];
  for (const f of files) {
    try {
      if (fs.existsSync(f)) {
        const raw = JSON.parse(fs.readFileSync(f, "utf8"));
        const j = raw && raw.FCAOption && raw.FCAOption.juwel;
        if (j && typeof j === "object") cfg = merge(cfg, j);
      }
    } catch (_) {}
  }
  if (extra && typeof extra === "object") cfg = merge(cfg, extra);
  return cfg;
}

function say(cfg, msg) {
  if (cfg && cfg.logging === false) return;
  try {
    process.stdout.write("AMINUL-SARDAR-FCA: " + msg + "\n");
  } catch (_) {}
}

// ---------------------------------------------------------------- cookies

function cookieNames(source) {
  try {
    if (!source) return [];
    if (Array.isArray(source)) return source.map((c) => c && (c.key || c.name)).filter(Boolean);
    if (typeof source.getCookiesSync === "function") {
      return source.getCookiesSync("https://www.facebook.com").map((c) => c.key || c.name);
    }
  } catch (_) {}
  return [];
}

/** Returns { ok, missing, names } for a cookie jar or an appState array. */
function checkCookies(source) {
  const names = cookieNames(source);
  const missing = WANTED_COOKIES.filter((n) => names.indexOf(n) === -1);
  const fatal = REQUIRED_COOKIES.filter((n) => names.indexOf(n) === -1);
  return { ok: fatal.length === 0, missing, fatal, names };
}

function cookieError(result) {
  const e = new Error(
    "Cookie/appstate invalid: missing " + result.fatal.join(", ") +
      ". Export a fresh full appstate from a logged-in browser (it must contain c_user, xs and datr)."
  );
  e.code = "JUWEL_BAD_COOKIE";
  return e;
}

// ---------------------------------------------------------------- errors

function explainError(err) {
  const s = String((err && (err.message || err.error)) || err || "");
  if (/Temporary Failure|transientError/i.test(s)) return "Facebook returned a temporary failure (often: no existing chat with that user, not friends, or the account is limited).";
  if (/1545012/.test(s)) return "The bot account is not a member of that conversation.";
  if (/1545003|1545026|1545025/.test(s)) return "Facebook refused to deliver to that thread (blocked / removed / cannot reply).";
  if (/checkpoint|956|login_required|not logged in|Not logged in/i.test(s)) return "Facebook session looks logged out or in checkpoint. Add a NEW cookie (appstate.json) and restart; if the account is locked, verify it in a browser first.";
  if (/rate|too fast|429|spam|temporarily/i.test(s)) return "Facebook is rate limiting this account. Increase sendQueue delays and slow the bot down.";
  if (/ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(s)) return "Network problem reaching Facebook (server/DNS). It is usually temporary.";
  if (/message_thread|thread may not exist|restricted/i.test(s)) return "Thread info is unavailable for this account (no access or Facebook returned empty data).";
  if (/GraphQL/i.test(s)) return "Facebook returned a GraphQL error (temporary or account restricted).";
  if (/Invalid thread ID/i.test(s)) return "The thread ID is invalid.";
  return "";
}

function isNetworkError(err) {
  const s = String((err && (err.code || err.message)) || err || "");
  if (err && err.code === "JUWEL_BAD_COOKIE") return false;
  return /ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|socket hang up|network|timeout|50[0234]/i.test(s);
}

// ---------------------------------------------------------------- queue

function createSendQueue(cfg, stats) {
  const q = cfg.sendQueue;
  const tasks = [];
  let running = false;
  let lastEnd = 0;

  function delayFor() {
    const lo = Math.max(0, Number(q.minDelayMs) || 0);
    const hi = Math.max(lo, Number(q.maxDelayMs) || lo);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (tasks.length) {
        const job = tasks.shift();
        stats.queueLength = tasks.length;
        const wait = lastEnd + delayFor() - Date.now();
        if (wait > 0 && lastEnd) await new Promise((r) => setTimeout(r, wait));
        let timer;
        const timeout = new Promise((r) => {
          timer = setTimeout(() => {
            stats.queueTimeouts++;
            r();
          }, Number(q.taskTimeoutMs) || 60000);
        });
        try {
          await Promise.race([job(), timeout]);
        } catch (_) {}
        clearTimeout(timer);
        lastEnd = Date.now();
      }
    } finally {
      running = false;
    }
  }

  return {
    push(job) {
      return new Promise((resolve, reject) => {
        if (tasks.length >= (Number(q.maxQueue) || 500)) {
          return reject(new Error("AMINUL-SARDAR-FCA send queue is full (" + tasks.length + " waiting)."));
        }
        tasks.push(() => job().then(resolve, reject));
        stats.queueLength = tasks.length;
        drain();
      });
    },
    size: () => tasks.length,
  };
}

// ---------------------------------------------------------------- thread info

function fallbackThread(id, isGroupHint) {
  const sid = String(id);
  return {
    threadID: sid,
    threadName: "",
    name: "",
    participantIDs: [],
    userInfo: [],
    adminIDs: [],
    nicknames: {},
    isGroup: typeof isGroupHint === "boolean" ? isGroupHint : sid.length >= 16,
    isCanonical: !(sid.length >= 16),
    approvalMode: false,
    approvalQueue: [],
    emoji: null,
    color: null,
    imageSrc: null,
    messageCount: 0,
    unreadCount: 0,
    canReply: true,
    inviteLink: { enable: false, link: null },
    __juwelFallback: true,
  };
}

function normalizeThread(info, id) {
  if (!info || typeof info !== "object") return null;
  if (!Array.isArray(info.adminIDs)) info.adminIDs = [];
  if (!Array.isArray(info.participantIDs)) info.participantIDs = [];
  if (!Array.isArray(info.userInfo)) info.userInfo = [];
  if (!info.nicknames || typeof info.nicknames !== "object") info.nicknames = {};
  if (!info.threadID) info.threadID = String(id);
  return info;
}

// ---------------------------------------------------------------- main

function applyJuwelSafety(api, ctx, globalOptions, extraSettings) {
  if (!api || api.__juwelSafety) return api;
  const cfg = loadSettings(extraSettings);
  const stats = {
    started: Date.now(),
    sent: 0,
    sendFailed: 0,
    queueLength: 0,
    queueTimeouts: 0,
    threadInfoOk: 0,
    threadInfoCacheHits: 0,
    threadInfoFallbacks: 0,
    lastError: "",
    lastBackup: null,
  };
  const cache = new Map();
  const warnedAt = {};
  function warnOnce(key, msg, everyMs) {
    const now = Date.now();
    if (warnedAt[key] && now - warnedAt[key] < (everyMs || 60000)) return;
    warnedAt[key] = now;
    say(cfg, msg);
  }

  // ---- getThreadInfo
  if (cfg.threadInfo.fallback && typeof api.getThreadInfo === "function") {
    const orig = api.getThreadInfo;
    api.getThreadInfo = function (threadID, callback) {
      const isArr = Array.isArray(threadID);
      const cb = typeof callback === "function" ? callback : null;
      const ttl = Number(cfg.threadInfo.cacheTtlMs) || 0;

      const run = async () => {
        if (!isArr) {
          const hit = cache.get(String(threadID));
          if (hit && ttl > 0 && Date.now() - hit.t < ttl) {
            stats.threadInfoCacheHits++;
            return hit.v;
          }
        }
        try {
          const tmo = Number(cfg.threadInfo.timeoutMs) || 0;
          let timer;
          const pending = orig.call(api, threadID);
          pending.catch(() => {});
          const res = tmo > 0
            ? await Promise.race([
                pending,
                new Promise((_, rej) => {
                  timer = setTimeout(() => rej(new Error("getThreadInfo timeout after " + tmo + "ms (Facebook did not answer)")), tmo);
                }),
              ]).finally(() => clearTimeout(timer))
            : await pending;
          if (isArr) {
            const out = res && typeof res === "object" ? res : {};
            threadID.forEach((id) => {
              const n = normalizeThread(out[id], id);
              if (n) {
                out[id] = n;
                cache.set(String(id), { t: Date.now(), v: n });
              } else {
                out[id] = (cache.get(String(id)) || {}).v || fallbackThread(id);
                stats.threadInfoFallbacks++;
              }
            });
            stats.threadInfoOk++;
            return out;
          }
          const n = normalizeThread(res, threadID);
          if (n) {
            cache.set(String(threadID), { t: Date.now(), v: n });
            stats.threadInfoOk++;
            return n;
          }
          throw new Error("getThreadInfo returned empty data");
        } catch (err) {
          if (/Invalid thread ID/i.test(String(err && err.message))) throw err;
          stats.lastError = String((err && err.message) || err).slice(0, 200);
          stats.threadInfoFallbacks++;
          const why = explainError(err);
          warnOnce(
            "ti" + (isArr ? "arr" : threadID),
            "getThreadInfo failed for " + (isArr ? threadID.join(",") : threadID) +
              " - using " + (!isArr && cache.get(String(threadID)) ? "cached" : "safe fallback") +
              " data. " + (why || stats.lastError)
          );
          if (isArr) {
            const out = {};
            threadID.forEach((id) => (out[id] = (cache.get(String(id)) || {}).v || fallbackThread(id)));
            return out;
          }
          const old = cache.get(String(threadID));
          return old ? old.v : fallbackThread(threadID);
        }
      };

      const p = run();
      if (cb) {
        p.then((d) => cb(null, d), (e) => cb(e));
      }
      return p;
    };
  }

  // ---- sendMessage queue
  if (cfg.sendQueue.enabled && typeof api.sendMessage === "function") {
    const origSend = api.sendMessage;
    const queue = createSendQueue(cfg, stats);
    api.sendMessage = function () {
      const args = Array.prototype.slice.call(arguments);
      const hasCb = args.some((a, i) => i > 0 && typeof a === "function");
      const self = this;
      const p = queue.push(() => {
        let r;
        try {
          r = origSend.apply(self, args);
        } catch (e) {
          return Promise.reject(e);
        }
        return Promise.resolve(r);
      });
      p.then(
        () => {
          stats.sent++;
        },
        (err) => {
          stats.sendFailed++;
          stats.lastError = String((err && (err.message || err.error)) || err).slice(0, 200);
          const why = explainError(err);
          if (err && typeof err === "object" && why && !err.friendly) {
            try {
              Object.defineProperty(err, "friendly", { value: why, enumerable: false });
            } catch (_) {}
          }
          warnOnce("send:" + stats.lastError.slice(0, 40), "sendMessage failed. " + (why || stats.lastError), 30000);
        }
      );
      // When a callback is used the caller never looks at the promise;
      // avoid an unhandled rejection crashing the process.
      if (hasCb) p.catch(() => {});
      return p;
    };
  }

  // ---- appState backup (file)
  function backupNow() {
    const b = cfg.appStateBackup;
    if (!b || !b.enabled || typeof api.getAppState !== "function") return false;
    try {
      const state = api.getAppState();
      const check = checkCookies(state);
      if (!Array.isArray(state) || !check.ok) return false;
      const file = path.resolve(process.cwd(), b.file || "appstate.backup.json");
      const tmp = file + ".tmp";
      try {
        if (fs.existsSync(file)) fs.copyFileSync(file, file.replace(/\.json$/, "") + ".prev.json");
      } catch (_) {}
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
      fs.renameSync(tmp, file);
      stats.lastBackup = Date.now();
      return true;
    } catch (_) {
      return false;
    }
  }
  api.backupAppState = backupNow;
  if (cfg.appStateBackup.enabled) {
    backupNow();
    const mins = Number(cfg.appStateBackup.intervalMin) || 30;
    const t = setInterval(backupNow, mins * 60000);
    if (t.unref) t.unref();
  }

  // ---- diagnostics
  api.getJuwelStats = function () {
    return Object.assign({}, stats, { queueLength: stats.queueLength, uptimeSec: Math.round((Date.now() - stats.started) / 1000) });
  };

  api.juwelDiag = async function (threadID) {
    const lines = [];
    let uid = "unknown";
    try {
      uid = api.getCurrentUserID();
    } catch (_) {}
    lines.push("Account ID: " + uid);
    let ck;
    try {
      ck = checkCookies(api.getAppState());
    } catch (_) {
      ck = { ok: false, missing: WANTED_COOKIES, fatal: REQUIRED_COOKIES, names: [] };
    }
    lines.push("Cookies: " + ck.names.length + (ck.missing.length ? " | MISSING: " + ck.missing.join(", ") : " | c_user/xs/datr present"));
    const t = (fn) =>
      Promise.race([
        Promise.resolve().then(fn).then(() => "OK", (e) => "FAILED: " + String((e && e.message) || e).slice(0, 150)),
        new Promise((r) => setTimeout(() => r("TIMEOUT (15s)"), 15000)),
      ]);
    if (typeof api.getThreadList === "function") {
      lines.push("Read inbox: " + (await t(() => new Promise((res, rej) => api.getThreadList(1, null, ["INBOX"], (e, d) => (e ? rej(e) : res(d)))))));
    }
    if (threadID && typeof api.getThreadInfo === "function") {
      let fb = false;
      const r = await t(async () => {
        const i = await api.getThreadInfo(threadID);
        fb = !!(i && i.__juwelFallback);
      });
      lines.push("Thread info: " + (fb ? "FALLBACK used (Facebook gave no data)" : r));
    }
    const s = api.getJuwelStats();
    lines.push("Sent: " + s.sent + " | Failed: " + s.sendFailed + " | Queue: " + s.queueLength);
    lines.push("ThreadInfo ok/cache/fallback: " + s.threadInfoOk + "/" + s.threadInfoCacheHits + "/" + s.threadInfoFallbacks);
    lines.push("Last backup: " + (s.lastBackup ? new Date(s.lastBackup).toISOString() : "none"));
    if (s.lastError) lines.push("Last error: " + s.lastError);
    const text = lines.join("\n");
    say(cfg, "DIAG\n" + text);
    return text;
  };

  api.__juwelSafety = true;
  api.juwelSettings = cfg;
  say(
    cfg,
    "Safety layer on (send queue " + (cfg.sendQueue.enabled ? cfg.sendQueue.minDelayMs + "-" + cfg.sendQueue.maxDelayMs + "ms" : "off") +
      ", thread fallback " + (cfg.threadInfo.fallback ? "on" : "off") + ")"
  );
  try { require('./juwelStatus').startStatusReport(api); } catch (_) {}
  return api;
}

module.exports = {
  applyJuwelSafety,
  loadSettings,
  checkCookies,
  cookieError,
  explainError,
  isNetworkError,
  createSendQueue,
  fallbackThread,
  DEFAULTS,
};
