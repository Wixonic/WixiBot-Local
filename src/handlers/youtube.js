let youtubeData = null;

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
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
					youtubeData.thumbnail = await discord.getExternalAsset(config.discord.application.clients.youtube.id, youtubeData.thumbnail);
					youtubeData.updatedAt = Date.now();
					youtubeData.timestamps = youtubeData.paused ? null : {
						start: Date.now() - youtubeData.time * 1000,
						end: Date.now() + (youtubeData.duration - youtubeData.time) * 1000
					};
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
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const process = async (logger, client, discord, server, config) => {
	if (youtubeData && youtubeData.updatedAt + 30 * 1000 < Date.now()) youtubeData = null;

	if (!youtubeData) {
		discord.removeActivity("youtube");
		return true;
	} else {
		/**
		 * @type {import("../types.d.ts").Activity}
		*/
		const activity = {
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
			timestamps: youtubeData.timestamps,
			name: youtubeData.name,
			details: youtubeData.name,
			state: `By ${youtubeData.author}`,
			type: "WATCHING"
		};

		const isValidURL = (string) => {
			try {
				const url = new URL(string);
				return url.protocol != "" && url.hostname != "";
			} catch { return false; }
		};

		if (!activity.assets.large_image) {
			if (activity.assets.small_image && isValidURL(activity.assets.small_image)) {
				activity.assets.large_image = activity.assets.small_image;
				delete activity.assets.small_image;
			} else delete activity.assets.large_image;
		}

		discord.addActivity("youtube", activity);
		return false;
	}
};

module.exports = {
	delay: 1 * 1000,
	init,
	process
};