const path = require("path");

const request = require("./request.js");

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../types.d.ts").Settings} settings
 * @param {string} name
 */
const addActivity = (logger, settings, name, data) => sendData(logger, settings, "POST", path.join("rpc", name), "application/json", JSON.stringify(data));

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../types.d.ts").Settings} settings
 * @param {string} name
 */
const removeActivity = (logger, settings, name) => sendData(logger, settings, "DELETE", path.join("rpc", name), "application/json");

/**
 * 
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../types.d.ts").Settings} settings
 * @param {import("../types.d.ts").RequestMethod} method
 * @param {string} path
 * @param {string} contentType
 */
const sendData = (logger, settings, method, path, contentType, data) => request(logger, {
	headers: {
		"Authorization": `WixKey ${settings.secrets.wixkey}`,
		"Content-Type": contentType
	},
	method,
	secure: process.env.dev !== "true",
	type: "json",
	url: new URL(path, settings.host),
	body: data
});

module.exports = {
	addActivity,
	removeActivity,
	sendData
};