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

	let lastBlenderUpdate = 0;
	const processBlender = async () => {
		if (blenderData && blenderData.date + 30 * 1000 < Date.now()) blenderData = null;

		if (!blenderData) discord.removeActivity("blender");
		else if (lastBlenderUpdate + 20 * 1000 < Date.now()) {
			discord.addActivity("blender", {
				level: 3,
				applicationId: config.discord.application.clientId,
				assets: {
					small_image: blenderData.small_image ? `https://cdn.discordapp.com/app-assets/${config.discord.application.clientId}/${config.discord.application.assets[blenderData.small_image]}.png` : null,
					small_text: blenderData.small_text,
					large_image: blenderData.large_image ? `https://cdn.discordapp.com/app-assets/${config.discord.application.clientId}/${config.discord.application.assets[blenderData.large_image]}.png` : null,
					large_text: blenderData.large_text
				},
				timestamps: {
					start: blenderData.startDate
				},
				name: "Blender",
				details: blenderData.details,
				state: blenderData.state,
				type: 0 // PLAYING
			});

			lastBlenderUpdate = Date.now();
		}
	};


	let githubData = null;

	server.app.post("/rpc/github/", (req, res) => {
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", () => {
			try {
				githubData = JSON.parse(body);
				githubData.date = Date.now();

				res.writeHead(200).end("Ok");
			} catch (e) {
				githubData = null;
				res.writeHead(400).end("Bad content");
			}
		});
	});

	let lastGitHubUpdate = 0;
	const processGitHub = async () => {
		if (githubData && githubData.date + 30 * 1000 < Date.now()) githubData = null;

		if (!githubData) discord.removeActivity("github");
		else if (lastGitHubUpdate + 20 * 1000 < Date.now()) {
			const type = githubData.type;

			switch (type) {
				case "repository":
					const owner = githubData.owner ?? "owner";
					const repo = githubData.repository ?? "repository";

					discord.addActivity(`github-${type}`, {
						level: 1,
						applicationId: config.discord.application.clientId,
						assets: {
							large_image: `https://cdn.discordapp.com/app-assets/${config.discord.application.clientId}/${config.discord.application.assets["github"]}.png`,
							large_text: "GitHub"
						},
						name: `${owner}/${repo}`,
						details: `Watching ${githubData.details ?? "the repository"}`,
						state: "On GitHub",
						type: 3 // WATCHING
					});
					break;

				case "profile":
					const profile = githubData.profile ?? "someone";

					discord.addActivity(`github-${type}`, {
						level: 1,
						applicationId: config.discord.application.clientId,
						assets: {
							large_image: `https://cdn.discordapp.com/app-assets/${config.discord.application.clientId}/${config.discord.application.assets["github"]}.png`,
							large_text: "GitHub"
						},
						name: `${profile}'${profile.endsWith("s") ? "" : "s"} profile`,
						details: `Watching ${githubData.details ?? "the profile"}`,
						state: "On GitHub",
						type: 3 // WATCHING
					});
					break;
			};

			lastGitHubUpdate = Date.now();
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
						level: 0,
						assets: {
							large_image: `spotify:${song.spotifyArtwork}`,
							large_text: song.album,
							small_image: `https://cdn.discordapp.com/app-assets/${config.discord.application.clientId}/${config.discord.application.assets.apple_music}.png`,
							small_text: "Apple Music"
						},
						timestamps: {
							start: song.startedAt,
							end: song.startedAt + song.duration
						},
						name: song.track,
						details: song.track,
						state: song.artist,
						type: 2 // LISTENING
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


	let lastMapRefresh = 0;
	let inWarThunderGameSince = null;

	const processWarThunder = async () => {
		const data = await wt(logger, config.warThunder);

		if (data.valid) {
			if (!inWarThunderGameSince) inWarThunderGameSince = Date.now();
			if (lastMapRefresh + 30 * 1000 < Date.now()) {
				const getImage = async () => {
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

					return await RichPresence.getExternal(discord.client, config.discord.application.clientId, new URL(`/warthunder/warthundermap.png?t=${Date.now()}`, "https://" + config.client.hostname));
				};

				const mapImage = await getImage();

				discord.addActivity("wt", {
					level: 4,
					applicationId: config.discord.application.clientId,
					assets: {
						large_image: mapImage[0].external_asset_path,
						large_image: `https://cdn.discordapp.com/app-assets/${config.discord.application.clientId}/${config.discord.application.assets.war_thunder}.png`,
						large_text: data.vehicle,
						small_image: `https://cdn.discordapp.com/app-assets/${config.discord.application.clientId}/${config.discord.application.assets.war_thunder}.png`,
						small_text: "War Thunder"
					},
					timestamps: {
						start: inWarThunderGameSince
					},
					name: "War Thunder",
					details: data.vehicle,
					type: 0 // PLAYING
				});

				lastMapRefresh = Date.now();
			}
		} else {
			discord.removeActivity("wt");
			inWarThunderGameSince = null;
		}
	};


	let youtubeData = null;
	server.app.post("/rpc/youtube/", (req, res) => {
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", () => {
			try {
				youtubeData = JSON.parse(body);
				youtubeData.date = Date.now();

				res.writeHead(200).end("Ok");
			} catch (e) {
				youtubeData = null;
				res.writeHead(400).end("Bad content");
			}
		});
	});

	let lastYouTubeUpdate = 0;
	const processYouTube = async () => {
		if (youtubeData && youtubeData.date + 30 * 1000 < Date.now()) youtubeData = null;

		if (!youtubeData) discord.removeActivity("youtube");
		else if (lastYouTubeUpdate + 20 * 1000 < Date.now()) {
			discord.addActivity("youtube", {
				level: 2,
				applicationId: config.discord.application.clientId,
				assets: {
					large_image: `https://cdn.discordapp.com/app-assets/${config.discord.application.clientId}/${config.discord.application.assets["youtube"]}.png`,
					large_text: "YouTube"
				},
				name: youtubeData.name,
				details: youtubeData.name,
				state: `By ${youtubeData.author}`,
				type: 3 // WATCHING
			});

			lastYouTubeUpdate = Date.now();
		}
	};


	const update = async () => {
		await processBlender();
		await processGitHub();
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