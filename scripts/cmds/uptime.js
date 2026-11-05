const os = require("os");

module.exports = {
  config: {
    name: "uptime",
    version: "1.0",
    author: "Aminul Sardar",
    countDown: 5,
    role: 0,
    shortDescription: "Bot uptime",
    longDescription: "Show bot uptime and system info",
    category: "system",
    guide: "{pn}"
  },

  onStart: async function ({ api, event, message, usersData, threadsData }) {
    try {
      const uptimeSec = process.uptime();
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = Math.floor(uptimeSec % 60);

      const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      // System info
      const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
      const usedMem = (totalMem - freeMem).toFixed(2);
      const cpuModel = os.cpus()[0].model;
      const cpuUsage = (process.cpuUsage().user / 1000000).toFixed(2);
      const platform = os.platform();
      
      // Bot stats
      const allUsers = await usersData.getAll();
      const allThreads = await threadsData.getAll();
      
      const now = new Date();
      const time = now.toLocaleString("en-BD", { timeZone: "Asia/Dhaka" });

      const msg = `╭─『 𝐀𝐌𝐈𝐍𝐔𝐋 𝐁𝐎𝐓 𝐔𝐏𝐓𝐈𝐌𝐄 』─╮
│
├─ ⏰ UPTIME: ${uptimeString}
├─ 📅 TIME: ${time}
│
├─ 💻 SYSTEM
├─ ❖ OS: ${platform} (${os.arch()})
├─ ❖ CPU: ${cpuModel.split("@")[0].trim()}
├─ ❖ RAM: ${usedMem}GB / ${totalMem}GB
├─ ❖ FREE: ${freeMem}GB
│
├─ 🤖 BOT STATS
├─ ❖ Users: ${allUsers.length}
├─ ❖ Groups: ${allThreads.length}
├─ ❖ Ping: ${Date.now() - event.timestamp}ms
│
╰─『 Aminul Sardar 』─╯`;

      return message.reply(msg);

    } catch (err) {
      return message.reply(`❌ Error: ${err.message}`);
    }
  }
};
