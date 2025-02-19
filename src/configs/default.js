const secrets = require("../secrets.js");

/**
 * @type {import("../types.d.ts").Config}
 */
const config = {
	client: {
		hostname: "server.wixonic.fr"
	},
	server: {
		cert: secrets.server.cert,
		key: secrets.server.key,
		port: 1000
	},
	rejectUnauthorized: true
};

module.exports = config;