const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const sharp = require("sharp");

// TEST
const r = require("./request.js");
const request = async (logger, options) => {
	const response = await r(logger, options);
	const filePath = path.join(__dirname, "..", "warthunder_test_data", options.url.pathname);
	const dirPath = path.dirname(filePath);
	if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(response), "utf-8");
	return response;
};
// const request = require("./request.js");
const { wait } = require("./utils.js");

/**
 * @type {import("@wixonic/logger").Logger}
 */
const emptyLogger = {
	debug: () => null,
	error: () => null,
	info: () => null,
	warn: () => null
};


/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {string} unit
 */
const getUnitData = async (logger, unit) => {
	const html = await request(emptyLogger, {
		url: new URL(path.join("unit", unit), "https://wiki.warthunder.com"),
		type: "text",
		method: "GET",
		headers: {
			accept: "text/html"
		}
	});

	const DOM = new JSDOM(html);
	const document = DOM.window.document;

	const nameEl = document.querySelector(".game-unit_name");
	const name = nameEl ? nameEl.textContent.trim() : unit;
	const rankEl = document.querySelector(".game-unit_card-info_item.game-unit_rank .game-unit_card-info_value");
	const rank = rankEl ? rankEl.textContent.trim() : "unknown";

	let role = null;
	const infoItems = document.querySelectorAll(".game-unit_card-info_item");
	infoItems.forEach(item => {
		const title = item.querySelector(".game-unit_card-info_title");
		if (title && title.textContent.trim() === "Main role") {
			const roleElement = item.querySelector(".text-truncate");
			if (roleElement) role = roleElement.textContent.trim();
		}
	});

	return {
		name,
		rank,
		role
	};
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../types.d.ts").Settings} settings
 */
const get = async (logger, settings) => {
	const errors = [];
	let info = {};
	let objs = {};
	let indicators = {};
	let map = Buffer.from("");
	let details = "Unknown unit";
	let unit = "Unknown unit";
	let mission = {};
	let messages = {};

	try {
		info = await request(emptyLogger, {
			url: new URL(settings.warthunder.paths.map.info, `http://localhost:${settings.warthunder.port}`),
			type: "json",
			secure: false
		});

		await wait(settings.warthunder.waitingTime);

		objs = await request(emptyLogger, {
			url: new URL(settings.warthunder.paths.map.objects, `http://localhost:${settings.warthunder.port}`),
			type: "json",
			secure: false
		});

		await wait(settings.warthunder.waitingTime);

		const imageResponse = await request(emptyLogger, {
			url: new URL(settings.warthunder.paths.map.image, `http://localhost:${settings.warthunder.port}`),
			type: "raw",
			secure: false
		});

		if (info.error) errors.push(`Map Info: ${info.error}`);
		if (objs.error) errors.push(`Map Objects: ${objs.error}`);
		if (imageResponse.error) errors.push(`Map: ${imageResponse.error}`);

		if (errors.length === 0) map = await sharp(Buffer.concat(imageResponse)).toFormat("png").toBuffer();
	} catch (e) {
		logger.warn(`Image: ${e}`);
	}

	await wait(settings.warthunder.waitingTime);

	if (errors.length === 0) {
		try {
			indicators = await request(emptyLogger, {
				url: new URL(settings.warthunder.paths.vehicle.indicators, `http://localhost:${settings.warthunder.port}`),
				type: "json",
				secure: false
			});

			if (indicators.error) throw indicators.error;

			if (indicators?.type === "dummy_plane") errors.push("Not spawned");
			else {
				switch (indicators?.army) {
					case "tank":
						const unitData = await getUnitData(logger, indicators.type.split("/").at(-1));
						unit = `${unitData.role ? unitData.role + " " : ""}${unitData.name}`;
						details = `${unit} (Rank ${unitData.rank}) - ${indicators.crew_current}/${indicators.crew_total} crew members remaining`;
						break;

					case "air":
						await wait(settings.warthunder.waitingTime);

						try {
							const state = await request(emptyLogger, {
								url: new URL(settings.warthunder.paths.vehicle.state, `http://localhost:${settings.warthunder.port}`),
								type: "json",
								secure: false
							});

							const altitude = Math.ceil(state["H, m"] / 100) * 100;
							const speed = Math.ceil(state["TAS, km/h"] / 50) * 50;

							const unitData = await getUnitData(logger, indicators.type.split("/").at(-1));

							unit = `${unitData.role ? unitData.role + " " : ""}${unitData.name}`;
							details = `${unit} (Rank ${unitData.rank}) - ${speed} km/h, ${altitude} m`;
						} catch (e) {
							errors.push(`State: ${e}`);
						}
						break;

					default:
						details = "Naval unit";
						unit = "Naval unit";
						break;
				};
			}
		} catch (e) {
			errors.push(`Indicators: ${e}`);
		}
	}

	await wait(settings.warthunder.waitingTime);

	if (errors.length === 0) {
		try {
			mission = await request(emptyLogger, {
				url: new URL(settings.warthunder.paths.mission, `http://localhost:${settings.warthunder.port}`),
				type: "json",
				secure: false
			});

			if (mission?.status !== "running") errors.push("Mission not running");
		} catch (e) {
			errors.push(`Mission: ${e}`);
		}
	}

	await wait(settings.warthunder.waitingTime);

	if (errors.length === 0) {
		try {
			messages.chat = await request(emptyLogger, {
				url: new URL(settings.warthunder.paths.messages.chat + "?lastId=0", `http://localhost:${settings.warthunder.port}`),
				type: "json",
				secure: false
			});

			await wait(settings.warthunder.waitingTime);

			messages.hud = await request(emptyLogger, {
				url: new URL(settings.warthunder.paths.messages.hud + "?lastEvt=0&lastDmg=0", `http://localhost:${settings.warthunder.port}`),
				type: "json",
				secure: false
			});
		} catch (e) {
			errors.push(`Messages: ${e}`);
		}
	}

	return {
		errors,
		info,
		objs,
		indicators,
		map,
		valid: errors.length === 0,
		details,
		unit,
		mission,
		messages
	};
};

module.exports = get;