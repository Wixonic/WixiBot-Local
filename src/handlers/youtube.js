const { RichPresence } = require("discord.js-selfbot-v13");

let youtubeData = null;

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {Client} client
 * @param {DiscordClient} discord
 * @param {Server} server
 * @param {import("./types.d.ts").Config} config
 */
const init = async (logger, client, discord, server, config) => {
	server.app.post("/rpc/youtube/", (req, res) => {
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", async () => {
			try {
				const youtubeResponse = JSON.parse(body);
				if (youtubeResponse.name != youtubeData?.name || youtubeResponse.author != youtubeData?.author) {
					youtubeData = youtubeResponse;
					youtubeData.thumbnail = (await RichPresence.getExternal(discord.client, config.discord.application.clients.youtube.id, youtubeData.thumbnail))[0].external_asset_path;
					youtubeData.startedAt = Date.now();
					youtubeData.updatedAt = Date.now();
					logger.info("Data updated");
				} else {
					if (youtubeData) youtubeData.updatedAt = Date.now();
					logger.debug("Timings updated");
				}

				res.writeHead(200).end("Ok");
			} catch (e) {
				youtubeData = null;
				res.writeHead(400).end("Bad content");
				logger.warn(e);
			}
		});
	});

	server.app.delete("/rpc/youtube/", (req, res) => youtubeData = null);
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {Client} client
 * @param {DiscordClient} discord
 * @param {Server} server
 * @param {import("./types.d.ts").Config} config
 */
const process = async (logger, client, discord, server, config) => {
	if (youtubeData && youtubeData.updatedAt + 30 * 1000 < Date.now()) youtubeData = null;

	if (!youtubeData) discord.removeActivity("youtube");
	else {
		discord.addActivity("youtube", {
			applicationId: config.discord.application.clients.youtube.id,
			assets: {
				small_image: config.discord.application.clients.youtube.assets.icon,
				small_text: "YouTube",
				large_image: youtubeData.thumbnail,
				large_text: youtubeData.name
			},
			buttons: [
				"Open video",
				"My channel"
			],
			metadata: {
				button_urls: [
					youtubeData.url,
					"https://go.wixonic.fr/youtube"
				]
			},
			timestamps: {
				start: youtubeData.startedAt
			},
			name: youtubeData.name,
			details: youtubeData.name,
			state: `By ${youtubeData.author}`,
			type: "WATCHING"
		});

		logger.debug("RPC updated");
	}
};

module.exports = {
	init,
	process
};