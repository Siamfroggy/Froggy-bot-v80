"use strict";

/**
 * AMINUL-SARDAR-FCA connection check + cookie help.
 * - Prints a tick (✔) for every part that is connected and a cross (✘) for
 *   every part that is not, once after login.
 * - Tells you to add a NEW cookie (appstate) when the cookie is missing,
 *   invalid or expired. It never changes bot behaviour.
 */

const OK = "✅";
const NO = "❌";

function out(msg) {
  try {
    process.stdout.write("AMINUL-SARDAR-FCA: " + msg + "\n");
  } catch (_) {}
}

// Returns a ready-to-print help text when the error is about the cookie, else "".
function cookieHelp(err) {
  const s = String((err && (err.message || err.error)) || err || "");
  if (!/JUWEL_BAD_COOKIE|appstate|app state|cookie|No usable cookies|checkpoint|login_required|not logged in|Error retrieving userID/i.test(s + " " + (err && err.code))) {
    return "";
  }
  return (
    "AMINUL-SARDAR-FCA: " + NO + " কুকি (appstate) নেই, ভুল, বা মেয়াদ শেষ।\n" +
    "AMINUL-SARDAR-FCA: ➤ করণীয়: নতুন কুকি (appstate.json) যোগ করে বট রিস্টার্ট দিন।\n" +
    "AMINUL-SARDAR-FCA: (Cookie missing, invalid or expired - add a NEW cookie / appstate and restart.)\n" +
    "AMINUL-SARDAR-FCA: Reason: " + s.slice(0, 160) + "\n"
  );
}

function withTimeout(fn, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, why: "no answer in " + Math.round(ms / 1000) + "s" }), ms);
    const done = (err) => {
      clearTimeout(timer);
      resolve(err ? { ok: false, why: String((err && err.message) || err).slice(0, 120) } : { ok: true });
    };
    try {
      const r = fn(done);
      if (r && typeof r.then === "function") r.then(() => done(null), (e) => done(e || new Error("failed")));
    } catch (e) {
      done(e);
    }
  });
}

function mqttUp(api) {
  const c = api && api.ctx && api.ctx.mqttClient;
  return !!(c && c.connected);
}

function cookieState(api) {
  try {
    return require("./juwelSafety").checkCookies(api.getAppState());
  } catch (_) {
    return { ok: false, missing: ["c_user", "xs", "datr"], fatal: ["c_user", "xs"], names: [] };
  }
}

async function buildStatus(api, waitMqttMs) {
  const rows = [];
  const add = (ok, text) => rows.push({ ok: !!ok, text });

  let uid = "";
  try {
    uid = String(api.getCurrentUserID());
  } catch (_) {}
  add(uid, uid ? "Login (ID " + uid + ")" : "Login: no user ID");

  const ck = cookieState(api);
  if (!ck.ok) {
    add(false, "Cookies NOT FOUND or invalid - add a NEW cookie (account.txt) and restart");
  } else {
    add(true, "Cookies (c_user, xs" + (ck.missing.includes("datr") ? "" : ", datr") + ")");
  }

  const until = Date.now() + (waitMqttMs || 0);
  while (!mqttUp(api) && Date.now() < until) await new Promise((r) => setTimeout(r, 1000));
  add(mqttUp(api), "Messenger live connection (MQTT)" + (mqttUp(api) ? "" : ": not connected, bot cannot hear messages"));

  if (typeof api.getThreadList === "function") {
    const r = await withTimeout((done) => api.getThreadList(1, null, ["INBOX"], done), 12000);
    add(r.ok, "Facebook inbox read" + (r.ok ? "" : ": " + r.why + " (commands may be slow or fail)"));
  }

  add(!!api.__juwelSafety, "Safety layer (send queue, thread fallback)");
  return rows;
}

async function printStatus(api, waitMqttMs) {
  const rows = await buildStatus(api, waitMqttMs);
  out("=== Connection check ===");
  rows.forEach((r) => out((r.ok ? OK : NO) + " " + r.text));
  const bad = rows.filter((r) => !r.ok).length;
  out(bad ? NO + " " + bad + " problem(s) found - see lines marked " + NO : OK + " All connected - bot is ready");
  if (!cookieState(api).ok) process.stdout.write(cookieHelp(new Error("cookie missing or invalid")));
  return rows;
}

function startStatusReport(api) {
  if (!api || api.__juwelStatus) return;
  api.__juwelStatus = true;
  api.juwelStatus = (waitMs) => printStatus(api, waitMs || 0);
  const s = api.juwelSettings || {};
  if (s.startupReport && s.startupReport.enabled === false) return;
  const t = setTimeout(() => {
    printStatus(api, 40000).catch(() => {});
  }, 3000);
  if (t.unref) t.unref();

  // Every 10 minutes: tell the owner if the cookie disappeared / expired while running.
  let lastWarn = 0;
  const w = setInterval(() => {
    try {
      if (!cookieState(api).ok && Date.now() - lastWarn > 3600000) {
        lastWarn = Date.now();
        process.stdout.write(cookieHelp(new Error("cookie missing or expired while running")));
      }
    } catch (_) {}
  }, 600000);
  if (w.unref) w.unref();
}

module.exports = { startStatusReport, printStatus, buildStatus, cookieHelp };
