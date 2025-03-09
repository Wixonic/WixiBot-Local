let blenderData = null;

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {Client} client
 * @param {DiscordClient} discord
 * @param {Server} server
 * @param {import("./types.d.ts").Config} config
 */
const init = async (logger, client, discord, server, config) => {
	server.app.post("/rpc/blender/", (req, res) => {
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", () => {
			try {
				blenderData = JSON.parse(body);
				blenderData.date = Date.now();
				logger.info("Data updated");

				res.writeHead(200).end("Ok");
			} catch (e) {
				blenderData = null;
				res.writeHead(400).end("Bad content");
			}
		});
	});
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {Client} client
 * @param {DiscordClient} discord
 * @param {Server} server
 * @param {import("./types.d.ts").Config} config
 */
const process = async (logger, client, discord, server, config) => {
	if (blenderData && blenderData.date + 30 * 1000 < Date.now()) blenderData = null;

	if (!blenderData) discord.removeActivity("blender");
	else {
		discord.addActivity("blender", {
			applicationId: config.discord.application.clients.blender.id,
			assets: {
				small_image: blenderData.small_image ? config.discord.application.clients.blender.assets[blenderData.small_image] : null,
				small_text: blenderData.small_text,
				large_image: blenderData.large_image ? config.discord.application.clients.blender.assets[blenderData.large_image] : null,
				large_text: blenderData.large_text
			},
			buttons: [
				"View my renders",
				"My website"
			],
			metadata: {
				button_urls: [
					"https://go.wixonic.fr/youtube",
					"https://wixonic.fr"
				]
			},
			timestamps: {
				start: blenderData.startDate
			},
			name: "Blender",
			details: blenderData.details,
			state: blenderData.state,
			type: "PLAYING"
		});

		logger.debug("RPC updated");
	}
};

module.exports = {
	init,
	process
};