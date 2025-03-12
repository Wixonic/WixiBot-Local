const { JSDOM } = require("jsdom");
const sharp = require("sharp");

const request = require("./request.js");
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
		url: "https://wiki.warthunder.com/unit/" + unit,
		type: "text",
		method: "GET"
	});

	const DOM = new JSDOM(html);
	const document = DOM.window.document;

	const name = document.querySelector(".game-unit_name").textContent.trim();
	const rank = document.querySelector(".game-unit_card-info_item.game-unit_rank .game-unit_card-info_value").textContent.trim();

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
 * @param {import("../types").WarThunderConfig} config
 */
const get = async (logger, config) => {
	const errors = [];
	let info = {};
	let map = Buffer.from("");
	let objs = {};
	let details = "Unknown unit";
	let unit = "Unknown unit";

	try {
		info = await request(emptyLogger, {
			url: new URL(config.paths.map.info, `http://localhost:${config.port}`),
			type: "json",
			secure: false
		});

		await wait(config.waitingTime);

		objs = await request(emptyLogger, {
			url: new URL(config.paths.map.objects, `http://localhost:${config.port}`),
			type: "json",
			secure: false
		});

		await wait(config.waitingTime);

		const imageResponse = await request(emptyLogger, {
			url: new URL(config.paths.map.image, `http://localhost:${config.port}`),
			type: "raw",
			secure: false
		});

		if (info.error) errors.push(`Map Info: ${info.error}`);
		if (objs.error) errors.push(`Map Objects: ${objs.error}`);
		if (imageResponse.error) errors.push(`Map: ${imageResponse.error}`);

		if (errors.length == 0) {
			const width = 512;
			const height = 512;

			let mapImage = sharp(Buffer.concat(imageResponse)).resize({
				width,
				height,
				fit: "contain"
			});

			const svgPoints = [];
			for (const obj of objs) {
				if (["ground_model", "aircraft"].includes(obj.type)) {
					svgPoints.push(`<circle cx="${obj.x * width}" cy="${obj.y * height}" r="${Math.max(width, height) / 50}" fill="${obj.color}" stroke="#FFF" stroke-width="${Math.max(width, height) / 500}" />`);
				}

				if (["capture_zone"].includes(obj.type)) {
					svgPoints.push(`<circle cx="${obj.x * width}" cy="${obj.y * height}" r="${Math.max(width, height) / 20}" fill="${obj.color}" stroke="#FFF" stroke-width="${Math.max(width, height) / 250}" />`);
				}
			}

			mapImage = mapImage.composite([{
				input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgPoints.join("")}</svg>`),
				top: 0,
				left: 0
			}]).toFormat("png");

			map = await mapImage.toBuffer();
		}
	} catch (e) {
		logger.warn(`Image: ${e}`);
	}

	await wait(config.waitingTime);

	if (errors.length == 0) {
		try {
			const indicators = await request(emptyLogger, {
				url: new URL(config.paths.vehicle.indicators, `http://localhost:${config.port}`),
				type: "json",
				secure: false
			});

			if (indicators.error) throw indicators.error;

			if (indicators?.type == "dummy_plane") errors.push("Not spawned");
			else {
				switch (indicators?.army) {
					case "tank":
						const unitData = await getUnitData(logger, indicators.type.split("/").at(-1));
						unit = `${unitData.role} ${unitData.name}`;
						details = `${unit} (Rank ${unitData.rank}) - ${indicators.crew_current}/${indicators.crew_total} crew members remaining`;
						break;

					case "air":
						await wait(config.waitingTime);

						try {
							const state = await request(emptyLogger, {
								url: new URL(config.paths.vehicle.state, `http://localhost:${config.port}`),
								type: "json",
								secure: false
							});

							const altitude = Math.ceil(state["H, m"] / 100) * 100;
							const speed = Math.ceil(state["TAS, km/h"] / 50) * 50;

							const unitData = await getUnitData(logger, indicators.type.split("/").at(-1));

							unit = `${unitData.role} ${unitData.name}`;
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

	return {
		errors,
		info,
		map,
		objs,
		valid: errors.length == 0,
		details,
		unit
	};
};

module.exports = get;