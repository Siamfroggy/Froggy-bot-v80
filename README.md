# 🐐 GoatBot V2 - Facebook Messenger Bot
> **Maintained by Aminul Sardar** &bull; Powered by Node.js & Local FCA Engine

![Nodejs Support](https://img.shields.io/badge/Node.js-v16.x%20%7C%20v22.x-brightgreen.svg?style=flat-square)
![Commands](https://img.shields.io/badge/Commands-67%20Loaded-blue.svg?style=flat-square)
![Events](https://img.shields.io/badge/Events-6%20Active-purple.svg?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)

A feature-rich, high-performance Facebook Messenger Chatbot built on top of GoatBot V2 framework with custom enhancements by **Aminul Sardar**.

---

## 🌟 Features & Highlights

- ⚡ **Local FCA Engine**: Powered by `Aminul Sardar FCA` with cross-domain Facebook cookie normalization (`.facebook.com`).
- 🎨 **Native Canvas Support**: Uses `@napi-rs/canvas` for ultra-fast, zero-native-build-dependency image generation (Rank cards, Weather cards, Moon phases, Emoji meaning, etc.).
- 🌐 **Web Dashboard & Control Panel**: Live HTTP Web Panel running on Port 3000 (`/`) featuring real-time bot picture, UID, status, and live digital uptime counter.
- 📡 **REST API Endpoints**:
  - `/api/bot-info`: Live JSON metadata endpoint providing bot name, avatar URL, prefix, UID, and uptime.
  - `/uptime`: Simple uptime endpoint returning system runtime in seconds.
- 🛡️ **Anti-Automation & Safety Queue**: Configurable message send queue and automatic MQTT re-connection fallback.
- 🗄️ **Multi-Database Support**: Out-of-the-box SQLite synchronization (`sqlite3` / `sequelize`).

---

## 👤 Bot Information & Credentials

| Setting | Value |
| :--- | :--- |
| **Bot ID (UID)** | `61596017104421` |
| **Maintainer** | Aminul Sardar |
| **Default Prefix** | `-` |
| **Admin Bot List** | `["61596017104421"]` |
| **Credentials File** | `account.txt` (JSON Array of AppState / Cookies) |
| **Config File** | `config.json` |

---

## 🚀 Getting Started

### 1. Installation & Setup
Install all required dependencies:
```bash
npm install
```

### 2. Configure Facebook Session (`account.txt`)
Paste your exported Facebook AppState / Cookies into `account.txt`:
```json
[
  {
    "key": "c_user",
    "value": "61596017104421",
    "domain": ".facebook.com",
    "path": "/"
  },
  {
    "key": "xs",
    "value": "your_xs_cookie_value",
    "domain": ".facebook.com",
    "path": "/"
  }
]
```

### 3. Start the Bot & Web Dashboard
```bash
npm start
```
The server will start on port `3000`. Access the web dashboard at `http://localhost:3000`.

---

## 🛠️ Folder Structure

```
├── account.txt              # Facebook AppState / Session Cookies
├── config.json              # Main Bot Configuration (Prefix, Admins, Language)
├── server.js                # Express Web Dashboard & API Endpoints
├── index.js                 # App Entrypoint
├── Goat.js                  # GoatBot Core Initialization
├── bot/
│   ├── handler/             # Action & Event Dispatchers
│   └── login/               # Authentication & Script Loaders
├── fb-chat-api/             # Local Aminul Sardar FCA Module
├── public/
│   └── index.html           # Live Web Dashboard UI
└── scripts/
    ├── cmds/                # 67 Active Bot Commands
    └── events/              # 6 Active Event Handlers
```

---

## 🔌 Web API Reference

### Get Bot Metadata & Uptime
**Endpoint:** `GET /api/bot-info`  
**Response:**
```json
{
  "status": "success",
  "botName": "GoatBot V2",
  "maintainer": "Aminul Sardar",
  "botID": "61596017104421",
  "avatarUrl": "https://graph.facebook.com/61596017104421/picture?type=large&width=500&height=500",
  "prefix": "-",
  "uptimeSeconds": 120,
  "formattedUptime": "0h 2m 0s",
  "systemStatus": "Online",
  "fcaModule": "Aminul Sardar FCA (Local)"
}
```

---

## 📜 Credits & License

- **GoatBot V2 Framework** created by [NTKhang](https://github.com/ntkhang03/Goat-Bot-V2)
- **Maintained & Custom Integrations** by **Aminul Sardar**
- **License**: MIT
