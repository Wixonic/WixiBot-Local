import request from "./request.js";

const host = "https://localhost:999/";

const config = {
	paths: {
		data: new URL("/rpc/warthunder/data.json", host),
		map: new URL("/rpc/warthunder/map.png", host)
	},
	port: 8111,
	waitingTime: 0.1
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

let canvas;
let ctx;
let data, map;

const camera = {
	position: [0, 0],
	moving: false,
	zoom: 1
};

const cycle = async () => {
	try {
		const dataResponse = await Promise.race([
			request("GET", config.paths.data, "json", "application/json", null, -1, false),
			new Promise((_, reject) => setTimeout(() => reject("Timeout"), 500))
		]);

		const imageResponse = await Promise.race([
			request("GET", config.paths.map, "blob", "image/png", null, -1, false),
			new Promise((_, reject) => setTimeout(() => reject("Timeout"), 500))
		]);

		data = dataResponse.response;
		map = await createImageBitmap(imageResponse.response);
	} catch (e) {
		console.error("Cycle failed:", e);
	}

	setTimeout(cycle, 1000);
};

const draw = () => {
	if (data && data.info && map) {
		const { info } = data;
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

			const worldWidth = info.map_max[0] - info.map_min[0];
			const worldHeight = info.map_max[1] - info.map_min[1];

			return [
				(x / worldWidth) * width * camera.zoom + camera.position[0],
				(y / worldHeight) * height * camera.zoom + camera.position[1]
			];
		};

		canvas.width = width;
		canvas.height = height;
		ctx.clearRect(0, 0, width, height);

		const [sx, sy] = worldToCanvasCoordinates(info.map_min);
		const [ex, ey] = worldToCanvasCoordinates(info.map_max);
		ctx.drawImage(map, sx, sy, ex - sx, ey - sy);

		const [gx, gy] = worldToCanvasCoordinates(info.grid_zero[0], info.grid_zero[1] - info.grid_size[1]);
		const [gx2, gy2] = worldToCanvasCoordinates(info.grid_zero[0] + info.grid_size[0], info.grid_zero[1]);
		const [stepX, stepY] = worldToCanvasCoordinates(info.grid_steps, null, false);

		ctx.strokeStyle = "#000";

		ctx.beginPath();

		for (let x = gx; x <= gx2; x += stepX) {
			const lineX = Math.min(x, gx2);
			ctx.moveTo(lineX, gy);
			ctx.lineTo(lineX, gy2);
		}

		for (let y = gy; y <= gy2; y += stepY) {
			const lineY = Math.min(y, gy2);
			ctx.moveTo(gx, lineY);
			ctx.lineTo(gx2, lineY);
		}
		ctx.lineWidth = drawSize;
		ctx.stroke();

		ctx.lineWidth = drawSize * 3;
		ctx.strokeRect(gx, gy, gx2 - gx, gy2 - gy);
	}

	requestAnimationFrame(draw);
};

addEventListener("DOMContentLoaded", () => {
	canvas = document.querySelector("canvas");
	ctx = canvas.getContext("2d");

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
	}
});

addEventListener("wheel", (event) => {
	const zoomFactor = 1.1;
	const prevZoom = camera.zoom;

	if (event.deltaY < 0) camera.zoom *= zoomFactor;
	else camera.zoom /= zoomFactor;

	const rect = canvas.getBoundingClientRect();
	const mouseX = (event.clientX - rect.left) * devicePixelRatio;
	const mouseY = (event.clientY - rect.top) * devicePixelRatio;

	camera.position[0] = mouseX - (mouseX - camera.position[0]) * (camera.zoom / prevZoom);
	camera.position[1] = mouseY - (mouseY - camera.position[1]) * (camera.zoom / prevZoom);

	event.preventDefault();
}, { passive: false });