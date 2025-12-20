const { addActivity, removeActivity } = require("../lib/activity.js");
const { getCurrentTrackInfo } = require("../lib/music.js");

let currentSong = null;

/**
 * @type {import("../types").HandlerInfo}
 */
const info = {
	path: "/music/",
	handlers: {},
	loop: {
		delay: 1 * 1000,
		process: async (logger, settings) => {
			let song = await getCurrentTrackInfo();

			if (song?.state === "PAUSED" && currentSong) {
				song = {
					...currentSong,
					state: "PAUSED"
				};
			}

			const needsUpdate = () => {
				if (song === null && currentSong === null) return false;
				if (song === null || currentSong === null) return true;

				return currentSong.state !== song.state ||
					currentSong.track !== song.track ||
					currentSong.artist !== song.artist ||
					Math.floor(currentSong.startedAt / 2000) !== Math.floor(song.startedAt / 2000);
			};

			if (needsUpdate()) {
				if (song === null) await removeActivity(logger, settings, "music");
				else await addActivity(logger, settings, "music", song);

				currentSong = song;
			}

			return currentSong === null;
		}
	}
};

module.exports = info;