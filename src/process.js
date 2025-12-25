const { log } = require("@wixonic/logger");

const Server = require("./lib/server.js");

const settings = require("./settings.js");

const { clone } = require("./lib/utils.js");

log.displayDate = false;

const main = async (logger) => {
	const handler = clone(logger);
	handler.error = (...any) => {
		let stacks = "";
		any.forEach((el) => {
			if (el instanceof Error) {
				stacks += el.stack;
				el = `${el.name}: ${el.message}`;
			}
		});
		logger.error(...any);
		if (stacks.length > 0) logger.debug("{Stack}", stacks.replaceAll("\n", "<br />"));
		process.exit(1);
	};

	process.on("uncaughtException", (e) => handler.error("Uncaught exception:", e));
	process.on("unhandledRejection", (e) => handler.error("Unhandled rejection:", e));

	try {
		const server = new Server(log, settings);
		await server.init();
	} catch (e) {
		handler.error(e);
	}
};

main(log);