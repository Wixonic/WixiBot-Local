const { RichPresence } = require("discord.js-selfbot-v13");

const request = require("../lib/request.js");

let lastSteamRefresh = 0;

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
	if (lastSteamRefresh + 15 * 1000 < Date.now()) {
		const response = (await request(emptyLogger, {
			method: "GET",
			type: "json",
			url: `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002?key=${config.steam.token}&steamids=${config.steam.id}`
		})).response ?? {};

		const player = response?.players?.at(0) ?? {};

		if (player.gameid) {
			const response = (await request(emptyLogger, {
				method: "GET",
				type: "json",
				url: `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${config.steam.token}&steamid=${config.steam.id}&include_appinfo=true&include_played_free_games=true&include_free_sub=true`
			})).response ?? {};

			const game = response?.games?.find((game) => game.appid == player.gameid);

			if (game) {
				discord.addActivity("steam", {
					applicationId: config.discord.application.clients.steam.id,
					assets: {
						large_image: (await RichPresence.getExternal(discord.client, config.discord.application.clients.steam.id, `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${player.gameid}/${game.img_icon_url}.jpg`))[0].external_asset_path,
						large_text: game.name,
						small_image: config.discord.application.clients.steam.assets.icon,
						small_text: "Steam"
					},
					buttons: [
						"Open game on Steam",
						"My profile"
					],
					metadata: {
						button_urls: [
							"https://store.steampowered.com/app/" + player.gameid,
							player.profileurl
						]
					},
					name: game.name,
					details: "Playing on Steam",
					type: "PLAYING"
				});
			} else {
				discord.addActivity("steam", {
					applicationId: config.discord.application.clients.steam.id,
					assets: {
						large_image: config.discord.application.clients.steam.assets.icon,
						large_text: "Steam"
					},
					buttons: [
						"Open game on Steam",
						"My profile"
					],
					metadata: {
						button_urls: [
							"https://store.steampowered.com/app/" + player.gameid,
							player.profileurl
						]
					},
					name: player.gameextrainfo,
					details: "Playing on Steam",
					type: "PLAYING"
				});
			}
		} else discord.removeActivity("steam");

		lastSteamRefresh = Date.now();
	}
};

module.exports = {
	process
};