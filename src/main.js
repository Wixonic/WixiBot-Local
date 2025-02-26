const fs = require("fs");
const path = require("path");
const { log } = require("@wixonic/logger");

// const Client = require("./client.js");
const Server = require("./server.js");

/**
 * @param {import("@wixonic/logger").Logger} logger
 */
const main = async (logger) => {
	const configPath = path.join(__dirname, "configs", (process.env.config ?? "default") + ".js");

	if (fs.existsSync(configPath)) {
		const config = require(configPath);

		logger.debug("Using", process.env.config ?? "default", "config");

		// const client = new Client(logger, config.client);
		const server = new Server(logger, config.server);

		// await client.init();
		await server.init();
	} else logger.error("Can't find the configuration file");
};

main(log);