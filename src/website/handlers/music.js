const { addActivity, removeActivity } = require("../../lib/activity.js");
const { getCurrentTrackInfo } = require("../../lib/music.js");

let currentSong = null;

/**
 * @type {import("../../types.d.ts").HandlerInfo}
 */
const info = {
	path: "/music/",
	handlers: {},
	loop: {
		delay: 1 * 1000,
		process: async (logger, settings) => {
			let song = await getCurrentTrackInfo();

			if ((song == null && currentSong != null) ||
				(song != null &&
					(currentSong == null ||
						currentSong.state != song.state ||
						currentSong.track != song.track ||
						currentSong.artist != song.artist ||
						currentSong.album != song.album ||
						Math.floor(currentSong.startedAt / 10000) != Math.floor(song.startedAt / 10000)))) {
				if (song == null) {
					currentSong = null;
					await removeActivity(logger, settings, "music");
				} else if ((currentSong?.state != "PAUSED" && song.state == "PAUSED") || song.state != "PAUSED") {
					currentSong = song;
					if (song.state == "PLAYING") await addActivity(logger, settings, "music", song);
					else await removeActivity(logger, settings, "music");
				}
			}
			return currentSong == null;
		}
	}
};

module.exports = info;