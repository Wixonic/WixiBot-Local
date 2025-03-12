const { RichPresence } = require("discord.js-selfbot-v13");

const request = require("../lib/request.js");
const wt = require("../lib/warThunder.js");

let lastWarThunderRefresh = 0;
let inWarThunderGameSince = null;

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
 * @param {Client} client
 * @param {DiscordClient} discord
 * @param {Server} server
 * @param {import("./types.d.ts").Config} config
 */
const process = async (logger, client, discord, server, config) => {
	if (lastWarThunderRefresh + 15 * 1000 < Date.now()) {
		const data = await wt(logger, config.warThunder);

		if (data.valid) {
			if (!inWarThunderGameSince) inWarThunderGameSince = Date.now();
			await request(emptyLogger, {
				url: new URL("/rpc/warthunder/map.png", "https://" + config.client.hostname),
				method: "POST",
				headers: {
					authorization: `WixKey ${config.client.wixkey}`,
					"content-type": "image/png"
				},
				secure: true,
				type: "raw",
				body: data.map.toString("base64url")
			});

			discord.addActivity("wt", {
				applicationId: config.discord.application.clients.war_thunder.id,
				assets: {
					large_image: (await RichPresence.getExternal(discord.client, config.discord.application.clients.war_thunder.id, new URL(`/warthunder/warthundermap.png?t=${Date.now()}`, "https://" + config.client.hostname)))[0].external_asset_path,
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
		} else {
			discord.removeActivity("wt");
			inWarThunderGameSince = null;
		}

		lastWarThunderRefresh = Date.now();
	}
};

module.exports = {
	process
};