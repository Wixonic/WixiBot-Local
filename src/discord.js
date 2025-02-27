const { Client } = require("discord.js-selfbot-v13");

const { clone } = require("./lib/utils.js");

class ClientManager {
	/**
	 * @type {Object<string, import("./types.d.ts").Activity>}
	 */
	activities = {};

	/**
	 * @type {Client?}
	 */
	client = null;

	/**
	 * @param {string} id
	 * @param {import("./types.d.ts").Activity} activity
	 */
	addActivity(id, activity) {
		clearTimeout(this.activities[id]?.keepAliveId);

		if (this.activities[id] != activity) {
			this.activities[id] = activity;
			this.updateActivities();
		}
	};

	/**
	 * @param {string} id
	 * @param {boolean?} fromKeepAlive
	 */
	removeActivity(id, fromKeepAlive = false) {
		clearTimeout(this.activities[id]?.keepAliveId);

		delete this.activities[id];
		this.updateActivities();
		if (fromKeepAlive) this.log(`${id} deleted by Keep-Alive.`);
	};

	async updateActivities() {
		/**
		* @type {import("./types.d.ts").Activity[]}
		*/
		const activities = Object.values(clone(this.activities));
		activities.sort((activityA, activityB) => (activityB.level ?? 0) - (activityA.level ?? 0));

		this.client.user.setPresence({
			activities,
			afk: true,
			status: Object.values(this.activities).length > 0 ? "idle" : "invisible"
		});
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