import request from "https://wixonic.fr/lib/request.js";

const config = {
	paths: {
		map: "https://server.wixonic.fr/rpc/warthunder/map.png",
		vehicle: {
			indicators: "/indicators",
			state: "/state"
		}
	},
	port: 8111,
	waitingTime: 0.1
};

/**
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
const wait = (milliseconds) => new Promise((resolve) => setTimeout(() => resolve(), milliseconds));

const cycle = async () => {
	try {
		const imageResponse = await Promise.race([
			request("GET", config.paths.map + `?t=${Date.now()}`, "blob", "image/png", null, -1, false),
			new Promise(async (_, reject) => {
				await wait(500);
				reject("Timeout");
			})
		]);

		document.querySelector("#map").src = URL.createObjectURL(imageResponse.response);
	} catch (e) {
		console.error("Cycle failed:", e);
	}

	setTimeout(cycle, 1000);
};

document.addEventListener("DOMContentLoaded", cycle);