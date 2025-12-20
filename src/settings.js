const secrets = require("./secrets.js");

/** @type {import("./types.d.ts").Settings} */
const settings = {
	host: process.env.dev === "true" ? "http://localhost:999" : "https://server.wixonic.fr",
	port: process.env.dev === "true" ? 998 : 1000,
	secrets,
	warthunder: {
		paths: {
			mission: "/mission.json",
			messages: {
				chat: "/gamechat",
				hud: "/hudmsg"
			},
			map: {
				image: "/map.img",
				info: "/map_info.json",
				objects: "/map_obj.json"
			},
			vehicle: {
				indicators: "/indicators",
				state: "/state"
			}
		},
		port: 8111,
		waitingTime: 0.1
	}
};

module.exports = settings;