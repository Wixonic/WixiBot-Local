const { RichPresence } = require("discord.js-selfbot-v13");
const fs = require("fs");
const path = require("path");
const { log } = require("@wixonic/logger");

// const Client = require("./lib/client.js");
const Server = require("./lib/server.js");
const DiscordClient = require("./lib/discord.js");

const { getCurrentTrackInfo } = require("./lib/music.js");
const request = require("./lib/request.js");
const spotify = require("./lib/spotify.js");
const wt = require("./lib/warThunder.js");

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {Client} client
 * @param {DiscordClient} discord
 * @param {Server} server
 * @param {import("./types.d.ts").Config} config
 */
const handlers = async (logger, client, discord, server, config) => {
	let blenderData = null;

	server.app.post("/rpc/blender/", (req, res) => {
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", () => {
			try {
				blenderData = JSON.parse(body);
				blenderData.date = Date.now();

				res.writeHead(200).end("Ok");
			} catch (e) {
				blenderData = null;
				res.writeHead(400).end("Bad content");
			}
		});
	});

	const processBlender = async () => {
		if (blenderData && blenderData.date + 30 * 1000 < Date.now()) blenderData = null;

		if (!blenderData) discord.removeActivity("blender");
		else {
			discord.addActivity("blender", {
				applicationId: config.discord.application.clients.blender.id,
				assets: {
					small_image: blenderData.small_image ? config.discord.application.clients.blender.assets[blenderData.small_image] : null,
					small_text: blenderData.small_text,
					large_image: blenderData.large_image ? config.discord.application.clients.blender.assets[blenderData.large_image] : null,
					large_text: blenderData.large_text
				},
				buttons: [
					"View my renders",
					"My website"
				],
				metadata: {
					button_urls: [
						"https://go.wixonic.fr/youtube",
						"https://wixonic.fr"
					]
				},
				timestamps: {
					start: blenderData.startDate
				},
				name: "Blender",
				details: blenderData.details,
				state: blenderData.state,
				type: "PLAYING"
			});
			logger.debug("[Blender RPC]", "RPC updated");
		}
	};


	let githubData = null;

	server.app.post("/rpc/github/", (req, res) => {
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", async () => {
			try {
				const githubResponse = JSON.parse(body);
				let conditions = githubResponse.type != githubData?.type;
				switch (githubResponse.type) {
					case "repository":
						conditions ||= githubResponse.repository != githubData?.repository || githubResponse.owner != githubData?.owner;
						break;

					case "profile":
						conditions ||= githubResponse.profile != githubData?.profile;
						break;
				};

				if (conditions) {
					githubData = githubResponse;
					githubData.startedAt = Date.now();
					githubData.updatedAt = Date.now();

					switch (githubResponse.type) {
						case "repository":
							githubData.large_image = (await RichPresence.getExternal(discord.client, config.discord.application.clients.github.id, `https://github.com/${githubData.owner}.png`))[0].external_asset_path;
							break;

						case "profile":
							githubData.large_image = (await RichPresence.getExternal(discord.client, config.discord.application.clients.github.id, `https://github.com/${githubData.profile}.png`))[0].external_asset_path;
							break;
					}

					logger.info("[GitHub RCP]", "Data updated");
				} else {
					if (githubData) githubData.updatedAt = Date.now();
					logger.debug("[GitHub RPC]", "Timings updated");
				}

				res.writeHead(200).end("Ok");
			} catch (e) {
				githubData = null;
				res.writeHead(400).end("Bad content");
			}
		});
	});

	server.app.delete("/rpc/github/", (req, res) => githubData = null);

	const processGitHub = async () => {
		if (githubData && githubData.updatedAt + 30 * 1000 < Date.now()) githubData = null;

		if (!githubData) discord.removeActivity("github");
		else {
			/**
			 * @type {import("./types.d.ts").Activity}
			 */
			let data = null;
			const type = githubData.type;

			switch (type) {
				case "repository":
					const owner = githubData.owner ?? "owner";
					const repo = githubData.repository ?? "repository";

					data = {
						applicationId: config.discord.application.clients.github.id,
						assets: {
							small_image: config.discord.application.clients.github.assets.icon,
							small_text: "GitHub",
							large_image: githubData.large_image,
							large_text: owner
						},
						buttons: [
							"Open repo on GitHub",
							"My profile"
						],
						metadata: {
							button_urls: [
								`https://github.com/${owner}/${repo}`,
								"https://go.wixonic.fr/github"
							]
						},
						name: `${owner}/${repo}`,
						details: `Watching ${githubData.details ?? "the repository"}`,
						state: "On GitHub",
						type: "WATCHING"
					};
					break;

				case "profile":
					const profile = githubData.profile ?? "someone";

					data = {
						applicationId: config.discord.application.clients.github.id,
						assets: {
							small_image: config.discord.application.clients.github.assets.icon,
							small_text: "GitHub",
							large_image: githubData.large_image,
							large_text: profile
						},
						buttons: [
							"Open profile on GitHub",
							"My profile"
						],
						metadata: {
							button_urls: [
								`https://github.com/${profile}`,
								"https://go.wixonic.fr/github"
							]
						},
						name: `${profile}'${profile.endsWith("s") ? "" : "s"} profile`,
						details: `Watching ${githubData.details ?? "the profile"}`,
						state: "On GitHub",
						type: "WATCHING"
					};
					break;
			};

			if (data) {
				discord.addActivity("github", data);
				logger.debug("[GitHub RPC]", "RPC updated");
			} else discord.removeActivity("github");
		}
	};

	let lastRobloxRefresh = 0;

	const processRoblox = async () => {
		if (lastRobloxRefresh + 15 * 1000 < Date.now()) {
			const response = await request(logger, {
				body: JSON.stringify({
					userIds: [
						config.roblox.id
					]
				}),
				headers: {
					"accept": "application/json",
					"content-type": "application/json",
					"cookie": ".ROBLOSECURITY=" + config.roblox.token
				},
				method: "POST",
				type: "json",
				url: "https://presence.roblox.com/v1/presence/users"
			});

			const presence = response?.userPresences?.at(0) ?? {};

			switch (presence.userPresenceType) {
				case 2: // InGame
					const icon = await request(logger, {
						url: `https://thumbnails.roblox.com/v1/games/icons?universeIds=${presence.universeId}&size=512x512&format=Png`,
						type: "json"
					});

					discord.addActivity("roblox", {
						applicationId: config.discord.application.clients.roblox.id,
						assets: {
							large_image: (await RichPresence.getExternal(discord.client, config.discord.application.clients.roblox.id, icon.data[0].imageUrl))[0].external_asset_path,
							large_text: presence.lastLocation,
							small_image: config.discord.application.clients.roblox.assets.icon,
							small_text: "Roblox"
						},
						buttons: [
							"Open place on Roblox",
							"My profile"
						],
						metadata: {
							button_urls: [
								"https://www.roblox.com/games/" + presence.rootPlaceId,
								"https://www.roblox.com/users/" + config.roblox.id
							]
						},
						timestamps: {
							start: new Date(presence.lastOnline).getTime()
						},
						name: presence.lastLocation,
						details: "Playing on Roblox",
						type: "PLAYING"
					});
					break;

				case 3: // InStudio
					discord.addActivity("roblox", {
						applicationId: config.discord.application.clients.roblox.id,
						assets: {
							large_image: config.discord.application.clients.roblox.assets.studio_icon,
							large_text: "Roblox Studio"
						},
						buttons: [
							"My profile"
						],
						metadata: {
							button_urls: [
								"https://www.roblox.com/users/" + config.roblox.id
							]
						},
						timestamps: {
							start: new Date(presence.lastOnline).getTime()
						},
						name: "Roblox Studio",
						details: "Creating in Roblox",
						type: "PLAYING"
					});
					break;

				default:
					discord.removeActivity("roblox");
					break;
			};

			lastRobloxRefresh = Date.now();
		}
	};


	let lastSteamRefresh = 0;

	const processSteam = async () => {
		if (lastSteamRefresh + 15 * 1000 < Date.now()) {
			const response = (await request(logger, {
				method: "GET",
				type: "json",
				url: `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002?key=${config.steam.token}&steamids=${config.steam.id}`
			})).response ?? {};

			const player = response?.players?.at(0) ?? {};

			if (player.gameid) {
				const response = (await request(logger, {
					method: "GET",
					type: "json",
					url: `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${config.steam.token}&steamid=${config.steam.id}&include_appinfo=true&include_played_free_games=true&include_free_sub=true`
				})).response ?? {};

				const game = response?.games?.find((game) => game.appid == player.gameid);

				if (game) {
					discord.addActivity("steam", {
						applicationId: config.discord.application.clients.steam.id,
						assets: {
							large_image: (await RichPresence.getExternal(discord.client, config.discord.application.clients.steam.id, `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${player.gameid}/${game.img_icon_url}.jpg`))[0].external_asset_path,
							large_text: game.name,
							small_image: config.discord.application.clients.steam.assets.icon,
							small_text: "Steam"
						},
						buttons: [
							"Open game on Steam",
							"My profile"
						],
						metadata: {
							button_urls: [
								"https://store.steampowered.com/app/" + player.gameid,
								player.profileurl
							]
						},
						name: game.name,
						details: "Playing on Steam",
						type: "PLAYING"
					});
				} else {
					discord.addActivity("steam", {
						applicationId: config.discord.application.clients.steam.id,
						assets: {
							large_image: config.discord.application.clients.steam.assets.icon,
							large_text: "Steam"
						},
						buttons: [
							"Open game on Steam",
							"My profile"
						],
						metadata: {
							button_urls: [
								"https://store.steampowered.com/app/" + player.gameid,
								player.profileurl
							]
						},
						name: player.gameextrainfo,
						details: "Playing on Steam",
						type: "PLAYING"
					});
				}
			} else discord.removeActivity("steam");

			lastSteamRefresh = Date.now();
		}
	};


	/**
	 * @type {import("./types.d.ts").Song?}
	 */
	let currentSong = null;
	const processTrack = async () => {
		let song = await getCurrentTrackInfo();

		const update = async () => {
			if (discord.activities.length > 0) discord.removeActivity("music");

			if (song == null) {
				currentSong = null;
				discord.removeActivity("music");

				logger.debug("Music stopped.");
			} else if ((currentSong?.state != "PAUSED" && song.state == "PAUSED") || song.state != "PAUSED") {
				if (song.state == "PAUSED" && currentSong) {
					song = currentSong;
					currentSong.state = "PAUSED";
				} else {
					const spotifySong = (await spotify.search(logger, config.spotify, `artist:${song.artist} track:${song.track}`)) ?? null;
					song.spotifyId = spotifySong?.id ?? null;
					const spotifyArtworkUrl = spotifySong?.album?.images?.at(0)?.url;
					song.spotifyArtwork = spotifyArtworkUrl?.slice((spotifyArtworkUrl?.lastIndexOf("/") ?? -1) + 1) ?? null;
				}

				if (song.state == "PLAYING") {
					discord.addActivity("music", {
						applicationId: config.discord.application.clients.apple_music.id,
						assets: {
							large_image: `spotify:${song.spotifyArtwork}`,
							large_text: song.album,
							small_image: config.discord.application.clients.apple_music.assets.icon,
							small_text: "Apple Music"
						},
						buttons: [
							"My profile",
							"My website"
						],
						metadata: {
							button_urls: [
								"https://music.apple.com/profile/wixonic",
								"https://wixonic.fr"
							]
						},
						timestamps: {
							start: song.startedAt,
							end: song.startedAt + song.duration
						},
						name: song.track,
						details: song.track,
						state: song.artist,
						type: "LISTENING"
					});
				} else discord.removeActivity("music");

				currentSong = song;
				logger.debug(`Music set to ${currentSong.track} by ${currentSong.artist} (${currentSong.state}).`);
			}
		};

		if (song == null) {
			if (currentSong != null) await update();
		} else {
			if (currentSong == null || (currentSong?.state != song.state || currentSong?.track != song.track || currentSong?.artist != song.artist || currentSong?.album != song.album || currentSong?.startedAt != song.startedAt)) await update();
		}
	};


	let lastWarThunderRefresh = 0;
	let inWarThunderGameSince = null;

	const processWarThunder = async () => {
		if (lastWarThunderRefresh + 15 * 1000 < Date.now()) {
			const data = await wt(logger, config.warThunder);

			if (data.valid) {
				if (!inWarThunderGameSince) inWarThunderGameSince = Date.now();
				await request(logger, {
					url: new URL("/rpc/warthunder/map.png", "https://" + config.client.hostname),
					method: "POST",
					headers: {
						authorization: `WixKey ${config.client.wixkey}`,
						"content-type": "image/png"
					},
					secure: true,
					type: "raw",
					body: data.map.toString("base64url")
				});

				discord.addActivity("wt", {
					applicationId: config.discord.application.clients.war_thunder.id,
					assets: {
						large_image: (await RichPresence.getExternal(discord.client, config.discord.application.clients.war_thunder.id, new URL(`/warthunder/warthundermap.png?t=${Date.now()}`, "https://" + config.client.hostname)))[0].external_asset_path,
						large_text: data.unit,
						small_image: config.discord.application.clients.war_thunder.assets.icon,
						small_text: "War Thunder"
					},
					buttons: [
						"My profile",
						"My website"
					],
					metadata: {
						button_urls: [
							"https://warthunder.com/community/userinfo/?nick=Wixonic%40psn",
							"https://wixonic.fr"
						]
					},
					timestamps: {
						start: inWarThunderGameSince
					},
					name: "War Thunder",
					details: data.details,
					type: "PLAYING"
				});
			} else {
				discord.removeActivity("wt");
				inWarThunderGameSince = null;

				logger.warn(data.errors.join(", "));
			}

			lastWarThunderRefresh = Date.now();
		}
	};


	let youtubeData = null;
	server.app.post("/rpc/youtube/", (req, res) => {
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", async () => {
			try {
				const youtubeResponse = JSON.parse(body);
				if (youtubeResponse.name != youtubeData?.name || youtubeResponse.author != youtubeData?.author) {
					youtubeData = youtubeResponse;
					youtubeData.thumbnail = (await RichPresence.getExternal(discord.client, config.discord.application.clients.youtube.id, youtubeData.thumbnail))[0].external_asset_path;
					youtubeData.startedAt = Date.now();
					youtubeData.updatedAt = Date.now();
					logger.info("[YouTube RCP]", "Data updated");
				} else {
					if (youtubeData) youtubeData.updatedAt = Date.now();
					logger.debug("[YouTube RPC]", "Timings updated");
				}

				res.writeHead(200).end("Ok");
			} catch (e) {
				youtubeData = null;
				res.writeHead(400).end("Bad content");
				logger.warn("[YouTube RPC]", e);
			}
		});
	});

	server.app.delete("/rpc/youtube/", (req, res) => youtubeData = null);

	const processYouTube = async () => {
		if (youtubeData && youtubeData.updatedAt + 30 * 1000 < Date.now()) youtubeData = null;

		if (!youtubeData) discord.removeActivity("youtube");
		else {
			discord.addActivity("youtube", {
				applicationId: config.discord.application.clients.youtube.id,
				assets: {
					small_image: config.discord.application.clients.youtube.assets.icon,
					small_text: "YouTube",
					large_image: youtubeData.thumbnail,
					large_text: youtubeData.name
				},
				buttons: [
					"Open video",
					"My channel"
				],
				metadata: {
					button_urls: [
						youtubeData.url,
						"https://go.wixonic.fr/youtube"
					]
				},
				timestamps: {
					start: youtubeData.startedAt
				},
				name: youtubeData.name,
				details: youtubeData.name,
				state: `By ${youtubeData.author}`,
				type: "WATCHING"
			});

			logger.debug("[YouTube RPC]", "RPC updated");
		}
	};


	const update = async () => {
		await processBlender();
		await processGitHub();
		await processRoblox();
		await processSteam();
		await processTrack();
		await processWarThunder();
		await processYouTube();

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
		 * @type {import("./types.d.ts").Config}
		 */
		const config = require(configPath);

		logger.debug("Using", process.env.config ?? "default", "config");

		// const client = new Client(logger, config.client);
		const discord = new DiscordClient(logger);
		const server = new Server(logger, config.server);

		const update = await handlers(logger, /*client*/ null, discord, server, config);

		// await client.init();
		await discord.login(config.discord.token);
		await server.init();

		update();
	} else logger.error("Can't find the configuration file");
};

main(log);