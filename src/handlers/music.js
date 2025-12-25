const { addActivity, removeActivity } = require("../lib/activity.js");
const { getCurrentTrackInfo } = require("../lib/music.js");

let currentSong = null;

/**
 * @type {import("../types.d.ts").HandlerInfo}
 */
const info = {
	path: "/music/",
	handlers: {},
	loop: {
		delay: 1 * 1000,
		process: async (logger, settings) => {
			let song = await getCurrentTrackInfo();

			if (song === undefined) {
				logger.warn("[Music] Failed to fetch track info");
				return false;
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
				let result;
				if (song === null) result = await removeActivity(logger, settings, "music");
				else result = await addActivity(logger, settings, "music", song);

				if (!result?.error) {
					currentSong = song;
				} else {
					logger.warn("[Music] Failed to update activity:", result.error);
				}
			}

			return false;
		}
	}
};

module.exports = info;