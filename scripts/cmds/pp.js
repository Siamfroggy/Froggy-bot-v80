const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "pp",
    version: "1.1",
    author: "Aminul Sardar",
    countDown: 5,
    role: 0,
    shortDescription: "Profile picture",
    longDescription: "Get profile picture of user",
    category: "image",
    guide: "{pn} @mention / reply / uid\n{pn} - get your own pp"
  },

  onStart: async function ({ api, event, args, message, usersData }) {
    let uid;

    if (event.messageReply) {
      uid = event.messageReply.senderID;
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
      uid = Object.keys(event.mentions)[0];
    } else if (args[0] && !isNaN(args[0])) {
      uid = args[0];
    } else {
      uid = event.senderID;
    }

    let waitMsg = null;
    try {
      waitMsg = await message.reply(`🔍 Fetching profile picture of ${uid}...`);
    } catch (_) {}

    const tmpDir = path.join(__dirname, "tmp");
    await fs.ensureDir(tmpDir);
    const imgPath = path.join(tmpDir, `${uid}_${Date.now()}_pp.jpg`);

    try {
      let name = "User";
      try {
        name = (await usersData.getName(uid)) || "User";
      } catch (_) {}

      // HD profile picture URL with fallback
      const primaryUrl = `https://graph.facebook.com/${uid}/picture?width=2048&height=2048&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
      const fallbackUrl = `https://graph.facebook.com/${uid}/picture?type=large&width=1000&height=1000`;

      let res;
      try {
        res = await axios.get(primaryUrl, { responseType: "arraybuffer", timeout: 10000 });
      } catch (_) {
        res = await axios.get(fallbackUrl, { responseType: "arraybuffer", timeout: 10000 });
      }

      await fs.writeFile(imgPath, Buffer.from(res.data));

      if (waitMsg && waitMsg.messageID) {
        try {
          await api.unsendMessage(waitMsg.messageID);
        } catch (_) {}
      }

      return api.sendMessage({
        body: `✅ Profile Picture\n\n👤 Name: ${name}\n🆔 UID: ${uid}\n🔗 https://facebook.com/${uid}`,
        attachment: fs.createReadStream(imgPath)
      }, event.threadID, (err) => {
        if (fs.existsSync(imgPath)) {
          try { fs.unlinkSync(imgPath); } catch (_) {}
        }
      }, event.messageID);

    } catch (err) {
      if (waitMsg && waitMsg.messageID) {
        try { await api.unsendMessage(waitMsg.messageID); } catch (_) {}
      }
      if (fs.existsSync(imgPath)) {
        try { fs.unlinkSync(imgPath); } catch (_) {}
      }
      return message.reply(`❌ Failed to get profile picture: ${err.message || err}`);
    }
  }
};