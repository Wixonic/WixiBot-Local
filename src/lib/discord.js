const { Client, RichPresence } = require("discord.js-selfbot-v13");

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
		changed ||= activity.timestamps?.start != previousActivity?.timestamps?.start;
		changed ||= activity.timestamps?.end != previousActivity?.timestamps?.end;
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
		delete this.activities[id];
		this.updateActivities();
	};

	async updateActivities() {
		/**
		* @type {import("../types.d.ts").Activity[]}
		*/
		const activities = Object.values(clone(this.activities));
		activities.sort((activityA, activityB) => (activityA.level ?? 0) - (activityB.level ?? 0));

		this.client.user.setPresence({
			activities,
			afk: true,
			status: Object.values(this.activities).length > 0 ? "idle" : "invisible"
		});
	};

	/**
	 * @param {import("discord.js-selfbot-v13").Snowflake} applicationId
	 * @param {string} url
	 * @returns {Promise<string | null>}
	 */
	async getExternalAsset(applicationId, url) {
		try {
			return await RichPresence.getExternal(discord.client, applicationId, url)[0].external_asset_path;
		} catch {
			this.logger.warn("Failed to get external url for:", url);
			return null;
		}
	};

	/**
	 * @param {import("@wixonic/logger").Logger} logger
	 */
	constructor(logger) {
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

		this.client.on("ready", () => {
			this.logger.info(`Logged in as ${this.client.user?.username ?? "unknown"}.`);
			this.updateActivities();
		});

		this.client.on("error", (error) => this.logger.error(`An error occured: ${error}`));

		this.destroyed = false;
		for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "uncaughtException", "unhandledRejection", "exit"]) {
			process.on(signal, async (reason, code) => {
				if (!this.destroyed) {
					this.destroyed = true;
					this.logger.warn("Destroying... | Reason:", reason ?? "Unknown", "| Code:", code ?? "None");

					try {
						this.client.destroy();
						process.exit(0);
					} catch (e) {
						this.logger.error("Failed to exit:", e);
					}
				}
			});
		}
	};

	/**
	 * @param {string} token
	 */
	async login(token) {
		await this.client.login(token);
	};
};

module.exports = ClientManager;