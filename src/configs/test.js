const secrets = require("../secrets.js");

/**
 * @type {import("../types.d.ts").Config}
 */
const config = {
	client: {
		hostname: "localhost:999"
	},
	server: {
		cert: secrets.server.cert,
		key: secrets.server.key,
		port: 1000
	},
	rejectUnauthorized: false
};

module.exports = config;