# AMINUL-SARDAR-FCA

Unofficial Facebook Chat API client for Messenger bots, maintained by Aminul Sardar.

## Features

- Real-time MQTT message listening and sending
- Automatic MQTT reconnection with session resume (session-stable)
- Text, reply, attachments, stickers, mentions and locations
- Thread, user, reaction, typing and read-state operations
- Auto typing indicator (configurable)
- Session recovery, auto re-login, adaptive rate limiting and request validation

## Install

```
npm install fb-chat-api
```

## Usage

```js
const login = require("fb-chat-api");

login({ appState: require("./appstate.json") }, (err, api) => {
  if (err) return console.error(err);
  api.listenMqtt((err, event) => {
    if (err) return console.error(err);
    console.log(event);
  });
});
```

## Notice

This is an unofficial client. Using it can get a Facebook account restricted or locked. Use a spare account and use it at your own risk.

## License

MIT. See the LICENSE file.

## Safety layer (v1.0.4)

Add this to the bot's `config.json` to tune it (all optional):

```json
"FCAOption": {
  "juwel": {
    "sendQueue":      { "enabled": true, "minDelayMs": 2000, "maxDelayMs": 2000 },
    "threadInfo":     { "fallback": true, "cacheTtlMs": 300000 },
    "loginRetry":     { "enabled": true, "delaysMin": [1, 2, 5, 10] },
    "appStateBackup": { "enabled": true, "file": "appstate.backup.json", "intervalMin": 30 }
  }
}
```

- `getThreadInfo` never returns null/empty: cached or safe fallback data is used when Facebook fails.
- Messages are sent one by one with a 2 s gap.
- Cookies are checked (`c_user`, `xs`, `datr`) with a clear message.
- Network login failures retry after 1, 2, 5, 10 minutes.
- `api.juwelDiag(threadID)` returns a health report; `api.getJuwelStats()` returns counters.
- Keep `appstate.backup.json` private - never commit it.
