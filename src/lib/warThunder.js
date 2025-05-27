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
 * @param {import("../types.d.ts").WarThunderConfig} config
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
			const width = 2048;
			const height = 2048;
			const iconSize = Math.min(width, height) / 64;
			const S = iconSize * 0.2;

			const scaleX = width / info.grid_size[0];
			const scaleY = height / info.grid_size[1];
			const offsetX = info.grid_zero[0] * scaleX;
			const offsetY = info.grid_zero[1] * scaleY;

			let mapImage = sharp(Buffer.concat(imageResponse)).resize({
				width,
				height,
				fit: "contain"
			});

			const svgEls = [];

			for (const key in objs) {
				const obj = objs[key];

				switch (obj.type) {
					case "airfield":
						svgEls.push(`<line x1="${obj.sx * info.grid_size[0] * scaleX - offsetX}" y1="${obj.sy * info.grid_size[1] * scaleY - offsetY}" x2="${obj.ex * info.grid_size[0] * scaleX - offsetX}" y2="${obj.ey * info.grid_size[1] * scaleY - offsetY}" stroke="${obj.color}" stroke-width="${iconSize / 2}" />`);
						break;

					case "ground_model":
						{
							const x = obj.x * info.grid_size[0] * scaleX;
							const y = obj.y * info.grid_size[1] * scaleY;

							switch (obj.icon) {
								case "Player":
									svgEls.unshift(`<path transform="rotate(${Math.atan2(obj.dy, obj.dx) * 180 / Math.PI + 90}, ${x + iconSize / 4}, ${y + iconSize / 4})" d="M ${x + iconSize / 4} ${y} L ${x + iconSize / 2} ${y + iconSize / 2} L ${x + iconSize / 4} ${y + iconSize * 0.375} L ${x} ${y + iconSize / 2} Z" fill="#FFF" stroke="#000" stroke-width="${iconSize / 16}" />`);
									break;

								case "LightTank":
									svgEls.push(`<path d="M ${x - 1.5} ${y - 2 / 3} h ${S * 3} v ${S * 4 / 3} h ${-S * 3} v ${-S * 4 / 3} z" fill="${obj.color}" stroke="#000" stroke-width="${iconSize / 16}" />`);
									break;

								case "MediumTank":
									svgEls.push(`<path d="M ${x - 1.5} ${y - 1} h ${S * 3} v ${S * 4 / 3} h ${-S * 2} v ${-S} h ${-S * 2} v ${S} h ${-S} v ${-S * 2} z" fill="${obj.color}" stroke="#000" stroke-width="${iconSize / 16}" />`);
									break;

								case "SPAA":
									svgEls.push(`<path d="M ${x - 0.5} ${y - 0.5} h ${S * 2 / 3} v ${S} h ${S * 2 / 3} v ${-S} h ${S * 2 / 3} v ${S} h ${S / 2} v ${S} h ${-3 * S} v ${-S} h ${S / 2} v ${-S} z" fill="${obj.color}" stroke="#000" stroke-width="${iconSize / 16}" />`);
									break;

								default:
									svgEls.push(`<rect x="${x - iconSize / 6}" y="${y - iconSize / 6}" width="${iconSize / 2}" height="${iconSize / 2}" fill="${obj.color}" stroke="#000" stroke-width="${iconSize / 16}"  />`);
									break;
							}
							break;
						}

					case "respawn_base_tank":
						svgEls.push(`<rect x="${obj.x * info.grid_size[0] * scaleX - iconSize / 16}" y="${obj.y * info.grid_size[1] * scaleY - iconSize / 16}" width="${iconSize / 8}" height="${iconSize / 8}" fill="${obj.color}"  />`);
						break;
				}
			}

			mapImage = mapImage.composite([{
				input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgEls.reverse().join("")}</svg>`),
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
						unit = `${unitData.role ? unitData.role + " " : ""}${unitData.name}`;
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