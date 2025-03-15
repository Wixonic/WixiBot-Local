const fs = require("fs");
const path = require("path");
const { log } = require("@wixonic/logger");

// const Client = require("./lib/client.js");
const Server = require("./lib/server.js");
const DiscordClient = require("./lib/discord.js");

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {Client} client
 * @param {DiscordClient} discord
 * @param {Server} server
 * @param {import("./types").Config} config
 */
const handlers = async (logger, client, discord, server, config) => {
	const folder = path.join(__dirname, "handlers");

	if (fs.existsSync(folder)) {
		for (const file of fs.readdirSync(folder)) {
			if (file.endsWith(".js")) {
				const hanlderPath = path.join(folder, file);
				const handlerName = file.slice(0, -3);

				const handlerLogger = {
					debug: (...args) => logger.debug(`[${handlerName} init]`, ...args),
					error: (...args) => logger.error(`[${handlerName} init]`, ...args),
					info: (...args) => logger.info(`[${handlerName} init]`, ...args),
					warn: (...args) => logger.warn(`[${handlerName} init]`, ...args)
				};

				const handler = require(hanlderPath);
				if (typeof handler.init == "function") await handler.init(handlerLogger, client, discord, server, config);
			}
		}
	}

	const update = async () => {
		if (fs.existsSync(folder)) {
			for (const file of fs.readdirSync(folder)) {
				if (file.endsWith(".js")) {
					const hanlderPath = path.join(folder, file);
					const handlerName = file.slice(0, -3);

					const handlerLogger = {
						debug: (...args) => logger.debug(`[${handlerName} process]`, ...args),
						error: (...args) => logger.error(`[${handlerName} process]`, ...args),
						info: (...args) => logger.info(`[${handlerName} process]`, ...args),
						warn: (...args) => logger.warn(`[${handlerName} process]`, ...args)
					};

					const handler = require(hanlderPath);
					if (typeof handler.process == "function") await handler.process(handlerLogger, client, discord, server, config);
				}
			}
		}

		setTimeout(update, 2500);
	};

	return update;
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 */
const main = async (logger) => {
	const configPath = path.join(__dirname, "configs", (process.env.config ?? "default") + ".js");

	if (fs.existsSync(configPath)) {
		/**
		 * @type {import("./types").Config}
		 */
		const config = require(configPath);

		logger.debug("Using", process.env.config ?? "default", "config");

		// const client = new Client(logger, config.client);
		const discord = new DiscordClient(logger);
		const server = new Server(logger, config.server);

		const handlersLogger = {
			debug: (...args) => logger.debug("[Handlers]", ...args),
			error: (...args) => logger.error("[Handlers]", ...args),
			info: (...args) => logger.info("[Handlers]", ...args),
			warn: (...args) => logger.warn("[Handlers]", ...args)
		};

		const update = await handlers(handlersLogger, /*client*/ null, discord, server, config);

		// await client.init();
		await discord.login(config.discord.token);
		await server.init();

		update();
	} else logger.error("Can't find the configuration file");
};

main(log);