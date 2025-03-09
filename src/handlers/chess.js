let chessData = null;
let previousChessUrl = null;

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {Client} client
 * @param {DiscordClient} discord
 * @param {Server} server
 * @param {import("./types.d.ts").Config} config
 */
const init = async (logger, client, discord, server, config) => {
	server.app.post("/chess/", (req, res) => {
		logger.debug("Engine input");

		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", () => {
			console.log(logger);
		});

		// Chess engine
	});

	server.app.post("/rpc/chess/", (req, res) => {
		logger.debug("RPC input");

		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", () => {
			try {
				const startDate = chessData?.startDate ?? Date.now();
				chessData = JSON.parse(body);
				chessData.date = Date.now();

				if (chessData.url != previousChessUrl) {
					previousChessUrl = chessData.url;
					chessData.startDate = Date.now();

					logger.info("Data updated");
				} else {
					chessData.startDate = startDate;
					logger.debug("Timings updated");
				}

				res.writeHead(200).end("Ok");
			} catch (e) {
				chessData = null;
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
	if (chessData && chessData.date + 30 * 1000 < Date.now()) chessData = null;

	if (!chessData) discord.removeActivity("chess");
	else {
		discord.addActivity("chess", {
			applicationId: config.discord.application.clients.chess.id,
			buttons: [
				"Watch game",
				"My profile"
			],
			metadata: {
				button_urls: [
					chessData.url,
					"https://go.wixonic.fr/chess"
				]
			},
			timestamps: {
				start: chessData.startDate
			},
			name: "Chess",
			type: "PLAYING"
		});

		logger.debug("RPC updated");
	}
};

module.exports = {
	init,
	process
};