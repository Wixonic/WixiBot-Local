let githubData = null;

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const init = async (logger, client, discord, server, config) => {
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
							githubData.large_image = await discord.getExternalAsset(config.discord.application.clients.github.id, `https://github.com/${githubData.owner}.png`);
							break;

						case "profile":
							githubData.large_image = await discord.getExternalAsset(config.discord.application.clients.github.id, `https://github.com/${githubData.profile}.png`);
							break;
					}

					logger.info("Data updated");
				} else {
					if (githubData) githubData.updatedAt = Date.now();
					logger.debug("Timings updated");
				}

				res.writeHead(200).end("Ok");
			} catch (e) {
				githubData = null;
				res.writeHead(400).end("Bad content");
			}
		});
	});

	server.app.delete("/rpc/github/", (req, res) => githubData = null);
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const process = async (logger, client, discord, server, config) => {
	if (githubData && githubData.updatedAt + 30 * 1000 < Date.now()) githubData = null;

	if (!githubData) discord.removeActivity("github");
	else {
		/**
		 * @type {import("../types.d.ts").Activity}
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

		if (data) discord.addActivity("github", data);
		else discord.removeActivity("github");
	}
};

module.exports = {
	init,
	process
};