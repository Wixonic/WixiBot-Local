const applescript = require("applescript");

const getCurrentTrackInfo = () => {
	const script = `
if application "Music" is running then
	tell application "Music"
		try
			set playerState to player state
			if playerState is playing or playerState is paused then
				set currentTrack to current track
				set trackName to name of currentTrack
				set artistName to artist of currentTrack
				set albumName to album of currentTrack
				
				try
					set startedAt to player position
				on error
					set startedAt to 0
				end try
				
				try
					set trackDuration to duration of currentTrack
				on error
					set trackDuration to 0
				end try
				
				if playerState is playing then
					return {"PLAYING", trackName, artistName, albumName, startedAt, trackDuration}
				else
					return {"PAUSED", trackName, artistName, albumName, startedAt, trackDuration}
				end if
			else
				return {"STOPPED", "", "", "", 0, 0}
			end if
		on error
			return {"ERROR", "", "", "", 0, 0}
		end try
	end tell
else
	return {"STOPPED", "", "", "", 0, 0}
end if`;

	const timeout = new Promise((resolve) => setTimeout(() => resolve(undefined), 5000));

	const execution = new Promise((resolve) => {
		applescript.execString(script, (e, result) => {
			if (e) {
				console.error("AppleScript error:", e);
				resolve(undefined);
			} else if (result[0] === "STOPPED") {
				resolve(null);
			} else if (result[0] === "ERROR") {
				resolve(undefined);
			} else {
				const [
					state,
					trackName,
					artistName,
					albumName,
					startedAt,
					duration
				] = result;

				resolve({
					state,
					track: trackName === "" ? "unknown track" : trackName,
					artist: artistName === "" ? "unknown artist" : artistName,
					album: albumName === "" ? "unknown album" : albumName,
					startedAt: Math.floor(Date.now() * 1e-3 - startedAt) * 1e3,
					duration: Math.floor(duration * 1e3)
				});
			}
		});
	});

	return Promise.race([execution, timeout]);
};

module.exports = {
	getCurrentTrackInfo
};