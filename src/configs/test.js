const secrets = require("../secrets.js");

/**
 * @type {import("../types.d.ts").Config}
 */
const config = {
	client: {
		hostname: "localhost:999",
		wixkey: "UzLjlbEtrFe7N6IGhIrBhehB8G6JDoce"
	},
	discord: {
		application: {
			clientId: "1179518852846067833",
			assets: {
				"Apple M2": "1328832475300102277",
				"Apple M4 Max": "1328832475723599995",
				apple_music: "1313227217194582076",
				blender: "1328822621550153791",
				github: "1344837104584101958",
				war_thunder: "1315377212257599558",
				youtube: "1313574569231257737"
			}
		},
		token: secrets.discord.token
	},
	server: {
		port: 1000
	},
	spotify: {
		id: secrets.spotify.id,
		secret: secrets.spotify.secret,
	},
	warThunder: {
		paths: {
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
		waitingTime: 0.05
	},
	rejectUnauthorized: false
};

module.exports = config;