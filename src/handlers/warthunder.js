const request = require("../lib/request.js");
const wt = require("../lib/warThunder.js");

let lastWarThunderRefresh = 0;
let inWarThunderGameSince = null;
let warThunderLargeImage = null;

/**
 * @type {import("@wixonic/logger").Logger}
 */
const emptyLogger = {
	debug: () => null,
	error: () => null,
	info: () => null,
	warn: () => null
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const process = async (logger, client, discord, server, config) => {
	const now = Date.now();
	const data = await wt(logger, config.warThunder);

	if (data.valid) {
		await request(emptyLogger, {
			url: new URL("/rpc/warthunder/map.png", "https://" + config.client.hostname),
			method: "POST",
			headers: {
				Authorization: `WixKey ${config.wixkey}`,
				"Content-Type": "image/png"
			},
			secure: true,
			type: "raw",
			body: data.map.toString("base64url")
		});

		if (!inWarThunderGameSince) inWarThunderGameSince = now;

		if (lastWarThunderRefresh + 15 * 1000 < now || !warThunderLargeImage) warThunderLargeImage = await discord.getExternalAsset(config.discord.application.clients.war_thunder.id, new URL(`/rpc/warthunder/map.png?t=${now}`, "https://" + config.client.hostname));

		discord.addActivity("wt", {
			applicationId: config.discord.application.clients.war_thunder.id,
			assets: {
				large_image: warThunderLargeImage,
				large_text: data.unit,
				small_image: config.discord.application.clients.war_thunder.assets.icon,
				small_text: "War Thunder"
			},
			buttons: [
				"My profile",
				"My website"
			],
			metadata: {
				button_urls: [
					"https://warthunder.com/community/userinfo/?nick=Wixonic%40psn",
					"https://wixonic.fr"
				]
			},
			timestamps: {
				start: inWarThunderGameSince
			},
			name: "War Thunder",
			details: data.details,
			type: "PLAYING"
		});

		lastWarThunderRefresh = now;

		return false;
	} else {
		discord.removeActivity("wt");
		inWarThunderGameSince = null;
		lastWarThunderRefresh = now;
		return true;
	}
};

module.exports = {
	delay: 1 * 1000,
	process
};