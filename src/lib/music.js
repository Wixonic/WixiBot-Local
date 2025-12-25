const applescript = require("applescript");

const getCurrentTrackInfo = () => new Promise((resolve) => {
	const script = `
if application "Music" is running then
	tell application "Music"
		set playerState to player state
		if playerState is playing then
			set currentTrack to current track
			set trackName to name of currentTrack
			set artistName to artist of currentTrack
			set albumName to album of currentTrack
			set startedAt to player position
			set trackDuration to duration of currentTrack
			
			return {"PLAYING", trackName, artistName, albumName, startedAt, trackDuration}
		else if playerState is paused then
			set currentTrack to current track
			set trackName to name of currentTrack
			set artistName to artist of currentTrack
			set albumName to album of currentTrack
			set startedAt to player position
			set trackDuration to duration of currentTrack
			
			return {"PAUSED", trackName, artistName, albumName, startedAt, trackDuration}
		else
			return {"STOPPED", "", "", "", 0, 0}
		end if
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
});

module.exports = {
	getCurrentTrackInfo
};