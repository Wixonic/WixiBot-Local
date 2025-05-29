const { getCurrentTrackInfo } = require("../lib/music.js");
const spotify = require("../lib/spotify.js");

/**
 * @type {import("../types.d.ts").Song?}
 */
let currentSong = null;

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const process = async (logger, client, discord, server, config) => {
	let song = await getCurrentTrackInfo();

	const update = async () => {
		if (discord.activities.length > 0) discord.removeActivity("music");

		if (song == null) {
			currentSong = null;
			discord.removeActivity("music");
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

			currentSong = song;

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
		}
	};

	if ((song == null && currentSong != null) ||
		(song != null &&
			(currentSong == null ||
				currentSong.state != song.state ||
				currentSong.track != song.track ||
				currentSong.artist != song.artist ||
				currentSong.album != song.album ||
				Math.floor(currentSong.startedAt / 10000) != Math.floor(song.startedAt / 10000)))) await update();
	return currentSong != null;
};

module.exports = {
	delay: 1 * 1000,
	process
};