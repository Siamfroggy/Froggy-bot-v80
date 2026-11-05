const express = require('express');
const path = require('path');
const http = require('http');

function startWebServer(api) {
	if (global.webServerStarted) return;
	global.webServerStarted = true;

	const app = express();

	app.use(express.static(path.join(__dirname, 'public')));

	app.get('/uptime', (req, res) => {
		res.type('json').send({
			status: "success",
			uptime: process.uptime(),
			unit: "seconds"
		});
	});

	app.get('/api/bot-info', (req, res) => {
		let botID = "61596017104421";
		let botName = global.GoatBot?.botInfo?.name || global.GoatBot?.config?.nickNameBot || "GoatBot V2";
		let prefix = global.GoatBot?.config?.prefix || "-";

		// Read runtime bot ID if available
		if (global.GoatBot?.botID) {
			botID = global.GoatBot.botID;
		} else {
			// Read fresh from account.txt on every request
			try {
				const fs = require('fs');
				const dirAccount = path.join(__dirname, 'account.txt');
				if (fs.existsSync(dirAccount)) {
					const data = JSON.parse(fs.readFileSync(dirAccount, 'utf8'));
					const c_user = Array.isArray(data) && data.find(item => item.key === 'c_user' || item.name === 'c_user');
					if (c_user && c_user.value) {
						botID = c_user.value;
					}
				}
			} catch (_) {}
		}

		const uptimeSec = process.uptime();
		const days = Math.floor(uptimeSec / (3600 * 24));
		const hours = Math.floor((uptimeSec % (3600 * 24)) / 3600);
		const minutes = Math.floor((uptimeSec % 3600) / 60);
		const seconds = Math.floor(uptimeSec % 60);
		const formatted = `${days > 0 ? days + 'd ' : ''}${hours}h ${minutes}m ${seconds}s`;

		res.type('json').send({
			status: "success",
			botName: botName,
			maintainer: "Aminul Sardar",
			botID: botID,
			avatarUrl: `https://graph.facebook.com/${botID}/picture?width=2048&height=2048&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
			prefix: prefix,
			uptimeSeconds: Math.floor(uptimeSec),
			formattedUptime: formatted,
			systemStatus: "Online",
			fcaModule: "Aminul Sardar FCA (Local)"
		});
	});

	app.get('*', (req, res) => {
		res.sendFile(path.join(__dirname, 'public', 'index.html'));
	});

	const ports = [3000];
	const envPort = parseInt(process.env.PORT, 10);
	if (envPort && !ports.includes(envPort)) {
		ports.push(envPort);
	}

	for (const p of ports) {
		const s = http.createServer(app);
		s.on('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				console.log(`[SERVER] Port ${p} already bound.`);
			} else {
				console.error(`[SERVER] Error on port ${p}:`, err);
			}
		});
		s.listen(p, '0.0.0.0', () => {
			if (global.utils?.log?.info) {
				global.utils.log.info("SERVER", `Web server running on http://0.0.0.0:${p}`);
			} else {
				console.log(`[SERVER] Web server running on http://0.0.0.0:${p}`);
			}
		});
	}
}

module.exports = startWebServer;
