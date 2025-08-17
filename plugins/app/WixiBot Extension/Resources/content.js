const cache = {
	youtube: {
		date: null,
		value: null,
		interval: null
	}
};

const onUnload = {
	data: null,
	path: null
};

const extensions = [
	{ // https://github.com/:owner/:repository[:anything]
		matches: [
			/^https:\/\/github\.com\/([\w-]+)\/([\w-]+)/m
		],
		run: (_, owner, repository) => {
			send("POST", "/rpc/github/", {
				type: "repository",
				owner,
				repository
			});

			onUnload.path = "/rpc/github/";
			onUnload.data = {
				type: "repository"
			};
		}
	}, { // https://github.com/:profile[:anything]
		matches: [
			/^https:\/\/github\.com\/([\w-]+)/m
		],
		run: (_, profile) => {
			send("POST", "/rpc/github/", {
				type: "profile",
				profile
			});

			onUnload.path = "/rpc/github/";
			onUnload.data = {
				type: "profile"
			};
		}
	}, { // https://[*.]youtube.com/watch[:anything]
		matches: [
			/^https:\/\/(?:[\w-]+\.)*youtube.com\/watch/m
		],
		run: (_) => {
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

			const update = () => {
				try {
					const videoElement = document.querySelector(".html5-video-player");
					data.paused = videoElement.className.includes("paused-mode");
					if (!videoElement.className.includes("ytp-autohide")) {
						cache.youtube.value = convertToSeconds(videoElement.querySelector(".ytp-time-current").innerHTML);
						cache.youtube.date = performance.now();
					}
					data.duration = convertToSeconds(videoElement.querySelector(".ytp-time-duration").innerHTML);
				} catch {
					data.paused = true;
				}
			};

			update();
			if (cache.youtube.interval) clearInterval(cache.youtube.interval);
			cache.youtube.interval = setInterval(update, 500);

			if (data != {}) {
				send("POST", "/rpc/youtube/", {
					type: "video",
					author: data.author,
					name: data.name,
					paused: data.paused,
					time: (cache.youtube.value ?? 0) + Math.floor((performance.now() - (cache.youtube.date ?? 0)) / 1000),
					duration: data.duration,
					thumbnail: data.thumbnailUrl,
					url: data["@id"]
				});

				onUnload.path = "/rpc/youtube/";
				onUnload.data = {
					type: "video"
				};
			}
		}
	}
];

const send = async (method = "POST", path = "/", data = {}) => {
	const response = await browser.runtime.sendMessage({
		action: "send",
		method,
		url: new URL(path, "https://server.wixonic.fr").toString(),
		data
	});

	if (response) {
		if (response.error) console.error("Error:", response.error);
		else console.log("Response:", response.data);
	}
};

const check = () => {
	const url = location.href;

	for (const extension of extensions) {
		for (const match of extension.matches) {
			const results = match.exec(url);

			if (results?.length > 0) {
				try {
					extension.run(...results);
				} catch (e) {
					console.warn(e);
				}

				break;
			}
		}
	}

	setTimeout(check, 10000);
};

window.addEventListener("load", check);

window.addEventListener("beforeunload", async () => {
	if (onUnload.path) await send("DELETE", onUnload.path, onUnload.data);
});
