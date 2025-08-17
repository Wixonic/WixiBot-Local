const { log } = require("@wixonic/logger");

const Server = require("./lib/server.js");

const settings = require("./settings.js");

log.displayDate = false;

const main = async () => {
	const server = new Server(log, settings);
	await server.init();
};

main();