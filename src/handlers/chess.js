const { spawn } = require("child_process");
const { WebSocket } = require("ws");

let chessData = null;
let currentBoardData = null;
/**
 * @type {import("ws").WebSocket?}
 */
let currentWs = null;
let previousChessUrl = null;
/**
 * @type {import("child_process").ChildProcessWithoutNullStreams?}
 */
let stockfish = null;

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {Client} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("./types.d.ts").Config} config
 */
const init = async (logger, client, discord, server, config) => {
	server.app.post("/chess/", (req, res) => {
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", () => {
			const boardData = JSON.parse(body);
			if (currentWs && currentWs.readyState == WebSocket.OPEN) currentWs.send(JSON.stringify({
				type: "board",
				data: boardData
			}));

			if (stockfish && !stockfish.killed) stockfish.stdin.write(`stop\nposition fen ${boardData.FEN}\n`);
			currentBoardData = boardData;

			res.sendStatus(204).end();

			logger.debug(`Received board data${currentWs && currentWs.readyState == WebSocket.OPEN ? ", sent to WebSocket" : ""}`);
		});
	});

	server.ws.on("connection", (ws) => {
		ws.once("message", async (data) => {
			if (data[0] == 0x01) {
				currentWs = ws;

				stockfish = spawn("stockfish");
				stockfish.stdin.write("uci\nsetoption name Threads value 15\nsetoption name Hash value 2048");

				await new Promise((resolve) => {
					let buffer = "";
					let cursor = 0;
					const waitUntilReady = (data) => {
						buffer += data.toString();

						const lines = buffer.split("\n");
						while (cursor < lines.length) {
							const line = lines[cursor - 1] ?? "";
							if (line == "uciok") {
								stockfish.stdout.off("data", waitUntilReady);
								resolve();
							}
							cursor++;
						}
					};
					stockfish.stdout.on("data", waitUntilReady);
				});
				ws.send("0x00");

				if (currentBoardData) {
					ws.send(JSON.stringify({
						type: "board",
						data: currentBoardData
					}));
				}

				const processLine = (line) => {
					line = line.split(" ");
					const command = line[0];

					if (ws.readyState === WebSocket.OPEN) {
						let data = {};

						switch (command) {
							case "info":
								for (let x = 1; x < line.length; x++) {
									const lineData = line[x];

									switch (lineData) {
										case "seldepth":
											data.depth = line[x + 1];
											x++;
											break;

										case "time":
											data.time = line[x + 1];
											x++;
											break;

										case "pv":
											data.best = line[x + 1];
											x++;
											break;

										case "cp":
											data.score = line[x + 1];
											x++;
											break;

										case "mate":
											data.mate = line[x + 1];
											x++;
											break;
									};
								}
								break;

							default:
								logger.debug("[Stockfish]", line.join(" "));
								break;
						};

						if (Object.keys(data).length > 0) ws.send(JSON.stringify(data));
					}
				};

				let buffer = "";
				let cursor = 0;
				stockfish.stdout.on("data", (data) => {
					buffer += data.toString();

					const lines = buffer.split("\n");
					while (cursor < lines.length) {
						const line = lines[cursor - 1] ?? "";
						processLine(line);
						cursor++;
					}
				});
				stockfish.stderr.on("data", (data) => {
					buffer += data.toString();

					const lines = buffer.split("\n");
					while (cursor < lines.length) {
						const line = lines[cursor - 1] ?? "";
						processLine(line);
						cursor++;
					}
				});

				ws.on("message", (data) => {
					try {
						const message = JSON.parse(data.toString("utf-8"));

						switch (message.type) {
							case "predict":
								logger.debug("Predicting...");
								stockfish.stdin.write("go movetime 1000\n");
								break;

							default:
								logger.warn("Invalid message:", data);
								break;
						};
					} catch {
						logger.warn(`Invalid message: Can't parse message "${data}"`);
					}
				});

				ws.on("close", () => {
					currentWs = null;
					if (stockfish && !stockfish.killed) stockfish.kill(0);
					logger.debug("WebSocket closed");
				});
			}
		});
	});

	server.app.post("/rpc/chess/", (req, res) => {
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

	server.app.delete("/rpc/chess/", (req, res) => chessData = null);
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