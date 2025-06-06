const time = {
	date: null,
	value: null
};

const onUnload = {
	path: null,
	data: null
};

addEventListener("DOMContentLoaded", async () => {
	const dataScripts = document.querySelectorAll(`script[type="application/ld+json"]`);
	let data = {};

	for (let x = 0; x < (dataScripts ?? []).length; ++x) {
		try {
			const dataScript = JSON.parse(dataScripts[x].innerHTML);

			if (dataScript["@type"] == "VideoObject") {
				data = dataScript;
				break;
			}
		} catch { }
	}

	const convertToSeconds = (time) => {
		time = time.split(":");
		let seconds = Number(time[0]) * 60 + Number(time[1]);
		if (time.length > 2) seconds = seconds * 60 + Number(time[2]);
		return seconds;
	};

	try {
		const videoElement = document.querySelector(".html5-video-player");

		data.paused = videoElement.className.includes("paused-mode");

		if (!videoElement.className.includes("ytp-autohide")) {
			time.value = convertToSeconds(videoElement.querySelector(".ytp-time-current").innerHTML);
			time.date = performance.now();
		}

		data.duration = convertToSeconds(videoElement.querySelector(".ytp-time-duration").innerHTML);
	} catch {
		data.paused = true;
	}

	if (data != {}) {
		await send("POST", "/rpc/youtube/", {
			type: "video",
			author: data.author,
			name: data.name,
			paused: data.paused,
			time: time?.value ?? 0 + Math.floor((performance.now() - time?.date ?? 0) / 1000),
			duration: data.duration,
			thumbnail: (data.thumbnailUrl ?? [])[0],
			url: `https://www.youtube.com/watch?v=${data.embedUrl.slice("https://www.youtube.com/embed/".length)}`
		});

		onUnload.path = "/rpc/youtube/";
		onUnload.data = {
			type: "video"
		};
	}
});

addEventListener("beforeunload", async () => await send("POST", onUnload.path, onUnload.data));

const send = async () => {
	const response = await browser.runtime.sendMessage({
		action: "send",
		method,
		url: new URL(path, "http://localhost:1000").toString(),
		data
	});

	if (response) {
		if (response.error) console.error("Error:", response.error);
		else console.log("Response:", response.data);
	}
};