const WebSocket = require("ws");

const request = require("./request.js");

class Client {
	/**
	 * @param {import("@wixonic/logger").Logger} logger
	 * @param {import("./types.d.ts").ClientConfig} config
	 */
	constructor(logger, config) {
		/**
		 * @type {import("@wixonic/logger").Logger}
		 */
		this.logger = {
			debug: (...any) => logger.debug("[Client]", ...any),
			error: (...any) => logger.error("[Client]", ...any),
			info: (...any) => logger.info("[Client]", ...any),
			warn: (...any) => logger.warn("[Client]", ...any)
		};

		this.http = new URL(`https://${config.host}`);
		this.ws = new WebSocket(`wss://${config.host}`);

		this.ws.on("error", this.error);
		this.ws.on("open", this.open);
	};

	error(e) {
		this.logger.error(e);
	};

	open() {
		this.logger.debug("Client connected");
	};
};

module.exports = Client;