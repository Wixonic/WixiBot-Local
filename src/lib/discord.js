const { Client, RichPresence } = require("discord.js-selfbot-v13");

const request = require("./request.js");
const { clone } = require("./utils.js");

class ClientManager {
	/**
	 * @type {Object<string, import("../types.d.ts").Activity>}
	 */
	activities = {};

	/**
	 * @type {Client?}
	 */
	client = null;

	/**
	 * @type {import("../types.d.ts").Config?}
	 */
	config = null;

	/**
	 * @param {string} id
	 * @param {import("../types.d.ts").Activity} activity
	 */
	addActivity(id, activity) {
		if (this.activityChanged(id, activity)) {
			this.activities[id] = activity;
			this.logger.info("Activity", id, "changed");
			this.updateActivities();
		}
	};

	/**
	 * @param {string} id
	 * @param {import("../types.d.ts").Activity} activity
	 */
	activityChanged(id, activity) {
		const previousActivity = this.activities[id];
		let changed = false;

		changed ||= activity.applicationId != previousActivity?.applicationId;
		changed ||= activity.assets?.small_image != previousActivity?.assets?.small_image;
		changed ||= activity.assets?.small_text != previousActivity?.assets?.small_text;
		changed ||= activity.assets?.large_image != previousActivity?.assets?.large_image;
		changed ||= activity.assets?.large_text != previousActivity?.assets?.large_text;
		changed ||= Math.floor((activity.timestamps?.start ?? 0) / 10000) != Math.floor((previousActivity?.timestamps?.start ?? 0) / 10000);
		changed ||= Math.floor((activity.timestamps?.end ?? 0) / 10000) != Math.floor((previousActivity?.timestamps?.end ?? 0) / 10000);
		changed ||= activity.name != previousActivity?.name;
		changed ||= activity.details != previousActivity?.details;
		changed ||= activity.state != previousActivity?.state;
		changed ||= activity.type != previousActivity?.type;

		return changed;
	};

	/**
	 * @param {string} id
	 */
	removeActivity(id) {
		if (this.activities[id]) {
			delete this.activities[id];
			this.updateActivities();
		}
	};

	async updateActivities() {
		/**
		* @type {import("../types.d.ts").Activity[]}
		*/
		const activities = Object.values(clone(this.activities));
		activities.sort((activityA, activityB) => (activityA.level ?? 0) - (activityB.level ?? 0));

		try {
			request(this.logger, {
				url: new URL("/activity/", "https://" + this.config.client.host),
				method: "POST",
				headers: {
					authorization: `WixKey ${this.config.wixkey}`,
					"content-type": "application/json"
				},
				secure: true,
				type: "text",
				body: JSON.stringify(this.activities)
			}).catch((e) => this.logger.warn("Failed to upload activites:", e));
		} catch (e) {
			this.logger.warn("Failed to upload activites:", e);
		}

		try {
			this.client.user.setPresence({
				activities,
				afk: true,
				status: Object.values(this.activities).length > 0 ? "idle" : "invisible"
			});
		} catch (e) {
			this.logger.warn("Failed to set activites:", e);
		}
	};

	/**
	 * @param {import("discord.js-selfbot-v13").Snowflake} applicationId
	 * @param {string} url
	 * @returns {Promise<string | null>}
	 */
	async getExternalAsset(applicationId, url) {
		try {
			return (await RichPresence.getExternal(this.client, applicationId, url))[0].external_asset_path;
		} catch (e) {
			this.logger.warn("Failed to get external url for:", url, "-", e);
			return null;
		}
	};

	/**
	 * @param {import("@wixonic/logger").Logger} logger
	 * @param {import("../types.d.ts").Config} config
	 */
	constructor(logger, config) {
		/**
		 * @type {import("@wixonic/logger").Logger}
		 */
		this.logger = {
			debug: (...any) => logger.debug("[Discord]", ...any),
			error: (...any) => logger.error("[Discord]", ...any),
			info: (...any) => logger.info("[Discord]", ...any),
			warn: (...any) => logger.warn("[Discord]", ...any)
		};

		this.activities = {};

		this.client = new Client({
			presence: {
				afk: true,
				status: "invisible"
			}
		});

		this.config = config;

		this.client.on("ready", () => {
			this.logger.info(`Logged in as ${this.client.user?.username ?? "unknown"}.`);
			this.updateActivities();
		});

		this.client.on("error", (error) => this.logger.error(`An error occured: ${error}`));
	};

	async login() {
		await this.client.login(this.config.discord.token);
	};
};

module.exports = ClientManager;