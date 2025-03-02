const secrets = require("../secrets.js");

/**
 * @type {import("../types.d.ts").Config}
 */
const config = {
	client: {
		hostname: "server.wixonic.fr",
		wixkey: secrets.client.wixkey
	},
	discord: {
		application: {
			clients: {
				apple_music: {
					id: "1344995710352883752",
					assets: {
						icon: "1345001699739172874"
					}
				},
				blender: {
					id: "1344996879402008681",
					assets: {
						icon: "1345001855448780830",
						"Apple M4 Max": "1345009271431237744"
					}
				},
				github: {
					id: "1345002044162834486",
					assets: {
						icon: "1345034466460045442"
					}
				},
				minecraft: {
					id: "1259643101614571643",
					assets: {
						icon: "1345001621960134757"
					}
				},
				roblox: {
					id: "1345002492160639089",
					assets: {
						icon: "1345002655847682099",
						studio_icon: "1345002655054958673"
					}
				},
				steam: {
					id: "1345002860416598027",
					assets: {
						icon: "1345003018483142656"
					}
				},
				vsc: {
					id: "1345007945997619290",
					assets: {
						icon: "1345008241561829437"
					}
				},
				war_thunder: {
					id: "1345003196581675019",
					assets: {
						icon: "1345003314856726559"
					}
				},
				youtube: {
					id: "1345003715819733002",
					assets: {
						icon: "1345004666408144987"
					}
				}
			}
		},
		token: secrets.discord.token
	},
	roblox: {
		id: secrets.roblox.id,
		token: secrets.roblox.token
	},
	server: {
		port: 1000
	},
	spotify: {
		id: secrets.spotify.id,
		secret: secrets.spotify.secret,
	},
	steam: {
		id: secrets.steam.id,
		token: secrets.steam.token
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
		waitingTime: 0.1
	},
	rejectUnauthorized: true
};

module.exports = config;