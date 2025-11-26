const { addActivity, sendData, removeActivity } = require("../lib/activity.js");
const wt = require("../lib/warthunder.js");

/**
 * @type {import("../types.d.ts").HandlerInfo}
 */
const info = {
	path: "/warthunder/",
	handlers: {},
	loop: {
		delay: 0.5 * 1000,
		process: async (logger, settings) => {
			const data = await wt(logger, settings);

			if (data.valid) {
				await sendData(logger, settings, "POST", "/rpc/warthunder/data.json", "application/json", JSON.stringify({
					info: data.info,
					objects: data.objs,
					indicators: data.indicators,
					unit: data.unit
				}));

				await sendData(logger, settings, "POST", "/rpc/warthunder/map.png", "image/png", data.map.toString("base64url"));

				await addActivity(logger, settings, "warthunder", {
					unit: data.unit,
					details: data.details
				});
			} else {
				await sendData(logger, settings, "DELETE", "/rpc/warthunder/data.json", "application/json");
				await sendData(logger, settings, "DELETE", "/rpc/warthunder/map.png", "image/png");

				await removeActivity(logger, settings, "warthunder");
			}

			return !data.valid;
		}
	}
};

module.exports = info;