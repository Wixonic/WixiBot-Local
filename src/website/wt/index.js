import request from "./request.js";

// const host = "https://localhost:999/";
const host = "https://server.wixonic.fr/";

const config = {
	paths: {
		data: new URL("/rpc/warthunder/data.json", host),
		map: new URL("/rpc/warthunder/map.png", host)
	},
	waitingTime: 0.1
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * @type {HTMLCanvasElement?}
 */
let canvas;
/**
 * @type {CanvasRenderingContext2D?}
 */
let ctx;

let data, map;

const camera = {
	position: [0, 0],
	moving: false,
	zoom: 1,

	keepInside: () => {
		camera.position[0] = Math.max(Math.min(camera.position[0], 0), canvas.width - canvas.width * camera.zoom);
		camera.position[1] = Math.max(Math.min(camera.position[1], 0), canvas.height - canvas.height * camera.zoom);
	}
};

const cycle = async () => {
	try {
		const dataResponse = await Promise.race([
			request("GET", config.paths.data, "json", "application/json", null, -1, false),
			new Promise((_, reject) => setTimeout(() => reject("Timeout"), 1000))
		]);

		const imageResponse = await Promise.race([
			request("GET", config.paths.map, "blob", "image/png", null, -1, false),
			new Promise((_, reject) => setTimeout(() => reject("Timeout"), 1000))
		]);

		data = dataResponse.response;
		if (performance.now() < 1000) console.log(data);
		map = await createImageBitmap(imageResponse.response);
	} catch (e) {
		console.error("Cycle failed:", e);
	}

	setTimeout(cycle, 1000);
};

const draw = async () => {
	try {
		if (data && data.info && data.objects && map) {
			const { info, objects } = data;
			const ratio = map.width / map.height;
			let width = innerWidth * devicePixelRatio;
			let height = width / ratio;

			if (height > innerHeight * devicePixelRatio) {
				height = innerHeight * devicePixelRatio;
				width = height * ratio;
			}

			const drawSize = Math.min(width, height) / 1000;

			const worldToCanvasCoordinates = (x, y, translate = true) => {
				if (Array.isArray(x)) {
					y = x[1];
					x = x[0];
				}

				if (translate) {
					x -= info.map_min[0];
					y -= info.map_min[1];
				}

				return [
					(x / (info.map_max[0] - info.map_min[0])) * width * camera.zoom + (translate ? camera.position[0] : 0),
					(y / (info.map_max[1] - info.map_min[1])) * height * camera.zoom + (translate ? camera.position[1] : 0)
				];
			};

			const gridToCanvasCoordinates = (x, y, translate) => {
				if (Array.isArray(x)) {
					y = x[1];
					x = x[0];
				}

				const [w, h] = [info.map_max[0] - info.map_min[0], info.map_max[1] - info.map_min[1]];

				x += info.map_min[0] / w;
				y += info.map_min[1] / h;

				return worldToCanvasCoordinates(x * w, y * h, translate);
			};

			canvas.width = width;
			canvas.height = height;
			ctx.clearRect(0, 0, width, height);

			const [sx, sy] = worldToCanvasCoordinates(info.map_min);
			const [ex, ey] = worldToCanvasCoordinates(info.map_max);
			ctx.drawImage(map, sx, sy, ex - sx, ey - sy);

			ctx.beginPath();

			const steps = worldToCanvasCoordinates(info.grid_steps, null, false);
			for (let x = camera.position[0] % steps[0]; x <= width; x += steps[0]) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
			for (let y = camera.position[1] % steps[1]; y <= height; y += steps[1]) { ctx.moveTo(0, y); ctx.lineTo(width, y); }

			ctx.strokeStyle = "#000";
			ctx.lineWidth = drawSize;
			ctx.stroke();

			const s = drawSize * 10;

			for (const obj of objects) {
				ctx.fillStyle = obj.color;
				ctx.lineWidth = drawSize;

				const [x, y] = gridToCanvasCoordinates(obj.x ?? 0, obj.y ?? 0);
				const [sx, sy] = gridToCanvasCoordinates(obj.sx ?? 0, obj.sy ?? 0);
				const [ex, ey] = gridToCanvasCoordinates(obj.ex ?? 0, obj.ey ?? 0);

				switch (obj.icon) {
					case "Player":
						{
							ctx.fillStyle = "#FFF";
							ctx.strokeStyle = "#000";

							ctx.save();
							const angle = Math.atan2(obj.dy, obj.dx) + Math.PI / 2;

							ctx.translate(x, y);
							ctx.rotate(angle);
							ctx.translate(0, -s / 6);

							ctx.beginPath();
							ctx.moveTo(0, -s);
							ctx.lineTo(s, s);
							ctx.lineTo(0, s / 2);
							ctx.lineTo(-s, s);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();

							ctx.restore();
						}
						break;

					case "capture_zone":
						{
							const s = drawSize * 15;
							ctx.beginPath();
							ctx.moveTo(x, y - s);
							ctx.lineTo(x + s, y);
							ctx.lineTo(x, y + s);
							ctx.lineTo(x - s, y);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "respawn_base_tank":
						{
							const s = drawSize * 1.5;
							ctx.fillRect(x - s / 2, y - s / 2, s, s);
						}
						break;

					case "LightTank":
						{
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 6);
							ctx.lineTo(x + s / 2, y - s / 6);
							ctx.lineTo(x + s / 2, y + s / 6);
							ctx.lineTo(x - s / 2, y + s / 6);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "MediumTank":
						{
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 6);
							ctx.lineTo(x + s / 2, y - s / 6);
							ctx.lineTo(x + s / 2, y + s / 3);
							ctx.lineTo(x + s / 5, y + s / 3);
							ctx.lineTo(x + s / 5, y + s / 6);
							ctx.lineTo(x - s / 5, y + s / 6);
							ctx.lineTo(x - s / 5, y + s / 3);
							ctx.lineTo(x - s / 2, y + s / 3);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "HeavyTank":
						{
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 6);
							ctx.lineTo(x - s / 3, y - s / 6);
							ctx.lineTo(x - s / 3, y - s / 3);
							ctx.lineTo(x + s / 3, y - s / 3);
							ctx.lineTo(x + s / 3, y - s / 6);
							ctx.lineTo(x + s / 2, y - s / 6);
							ctx.lineTo(x + s / 2, y + s / 3);

							ctx.lineTo(x + s / 5, y + s / 3);
							ctx.lineTo(x + s / 5, y + s / 6);
							ctx.lineTo(x - s / 5, y + s / 6);
							ctx.lineTo(x - s / 5, y + s / 3);

							ctx.lineTo(x - s / 2, y + s / 3);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "SPAA":
						{
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y);
							ctx.lineTo(x - s * 3 / 7, y);
							ctx.lineTo(x - s * 3 / 7, y - s / 4);
							ctx.lineTo(x - s / 20, y - s / 4);
							ctx.lineTo(x - s / 20, y);
							ctx.lineTo(x + s / 20, y);
							ctx.lineTo(x + s / 20, y - s / 4);
							ctx.lineTo(x + s * 3 / 7, y - s / 4);
							ctx.lineTo(x + s * 3 / 7, y);
							ctx.lineTo(x + s / 2, y);
							ctx.lineTo(x + s / 2, y + s / 3);
							ctx.lineTo(x - s / 2, y + s / 3);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "Airdefence":
						{
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y + s / 3);
							ctx.lineTo(x + s / 2, y + s / 3);
							ctx.lineTo(x + s / 2, y);
							ctx.lineTo(x + s / 6, y);
							ctx.lineTo(x + s / 6, y - s / 3);
							ctx.lineTo(x - s / 6, y - s / 3);
							ctx.lineTo(x - s / 6, y);
							ctx.lineTo(x - s / 2, y);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					default:
						{
							ctx.fillStyle = "#F0F";
							ctx.lineWidth = 0;
							ctx.fillRect(x - s / 2, y - s / 2, s, s);
						}
						break;
				}
			}
		};
	} catch (e) {
		console.error(e);
		await wait(1000);
	}

	requestAnimationFrame(draw);
};

addEventListener("DOMContentLoaded", () => {
	canvas = document.querySelector("canvas");
	ctx = canvas.getContext("2d");

	ctx.imageSmoothingEnabled = false;
	canvas.style.imageRendering = "pixelated";

	cycle();
	draw();
});

addEventListener("mousedown", () => camera.moving = true);
addEventListener("mouseup", () => camera.moving = false);
addEventListener("mouseleave", () => camera.moving = false);

addEventListener("mousemove", (event) => {
	if (camera.moving) {
		camera.position[0] += event.movementX * devicePixelRatio;
		camera.position[1] += event.movementY * devicePixelRatio;
		camera.keepInside();
	}
});

addEventListener("wheel", (event) => {
	const zoomFactor = 1.1;
	const prevZoom = camera.zoom;

	if (event.deltaY < 0) camera.zoom *= zoomFactor;
	else camera.zoom /= zoomFactor;

	if (camera.zoom < 1) camera.zoom = 1;

	const rect = canvas.getBoundingClientRect();
	const mouseX = (event.clientX - rect.left) * devicePixelRatio;
	const mouseY = (event.clientY - rect.top) * devicePixelRatio;

	camera.position[0] = mouseX - (mouseX - camera.position[0]) * (camera.zoom / prevZoom);
	camera.position[1] = mouseY - (mouseY - camera.position[1]) * (camera.zoom / prevZoom);
	camera.keepInside();

	event.preventDefault();
}, { passive: false });