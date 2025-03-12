const { RichPresence } = require("discord.js-selfbot-v13");

const request = require("../lib/request.js");

let lastRobloxRefresh = 0;

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
	if (lastRobloxRefresh + 15 * 1000 < Date.now()) {
		const response = await request(emptyLogger, {
			body: JSON.stringify({
				userIds: [
					config.roblox.id
				]
			}),
			headers: {
				"accept": "application/json",
				"content-type": "application/json",
				"cookie": ".ROBLOSECURITY=" + config.roblox.token
			},
			method: "POST",
			type: "json",
			url: "https://presence.roblox.com/v1/presence/users"
		});

		const presence = response?.userPresences?.at(0) ?? {};

		switch (presence.userPresenceType) {
			case 2: // InGame
				const icon = await request(emptyLogger, {
					url: `https://thumbnails.roblox.com/v1/games/icons?universeIds=${presence.universeId}&size=512x512&format=Png`,
					type: "json"
				});

				discord.addActivity("roblox", {
					applicationId: config.discord.application.clients.roblox.id,
					assets: {
						large_image: (await RichPresence.getExternal(discord.client, config.discord.application.clients.roblox.id, icon.data[0].imageUrl))[0].external_asset_path,
						large_text: presence.lastLocation,
						small_image: config.discord.application.clients.roblox.assets.icon,
						small_text: "Roblox"
					},
					buttons: [
						"Open place on Roblox",
						"My profile"
					],
					metadata: {
						button_urls: [
							"https://www.roblox.com/games/" + presence.rootPlaceId,
							"https://www.roblox.com/users/" + config.roblox.id
						]
					},
					timestamps: {
						start: new Date(presence.lastOnline).getTime()
					},
					name: presence.lastLocation,
					details: "Playing on Roblox",
					type: "PLAYING"
				});
				break;

			case 3: // InStudio
				discord.addActivity("roblox", {
					applicationId: config.discord.application.clients.roblox.id,
					assets: {
						large_image: config.discord.application.clients.roblox.assets.studio_icon,
						large_text: "Roblox Studio"
					},
					buttons: [
						"My profile"
					],
					metadata: {
						button_urls: [
							"https://www.roblox.com/users/" + config.roblox.id
						]
					},
					timestamps: {
						start: new Date(presence.lastOnline).getTime()
					},
					name: "Roblox Studio",
					details: "Creating in Roblox",
					type: "PLAYING"
				});
				break;

			default:
				discord.removeActivity("roblox");
				break;
		};

		lastRobloxRefresh = Date.now();
	}
};

module.exports = {
	process
};