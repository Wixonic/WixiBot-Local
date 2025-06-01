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
		if (performance.now() < 1000) console.log(data);
		map = await createImageBitmap(imageResponse.response);
	} catch (e) {
		console.error("Cycle failed:", e);
	}

	setTimeout(cycle, 1000);
};

const draw = () => {
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

		ctx.strokeStyle = "#000";

		ctx.beginPath();

		for (let x = info.map_min[0]; x <= info.map_max[0]; x += info.grid_steps[0]) {
			const xx = worldToCanvasCoordinates(Math.floor((x - info.map_max[0])), 0)[0];
			ctx.moveTo(xx, sy);
			ctx.lineTo(xx, ey);
		}

		for (let y = info.map_min[1]; y <= info.map_max[1]; y += info.grid_steps[1]) {
			const yy = worldToCanvasCoordinates(0, Math.min(y, info.map_max[1]))[1];
			ctx.moveTo(sx, yy);
			ctx.lineTo(ex, yy);
		}

		ctx.lineWidth = drawSize;
		ctx.stroke();

		for (const obj of objects) {
			switch (obj.type) {
				default:
					{
						ctx.fillStyle = "#F0F";
						ctx.lineWidth = 0;
						const [x, y] = gridToCanvasCoordinates(obj.x, obj.y);
						const s = drawSize * 2;
						ctx.fillRect(x - s / 2, y - s / 2, s, s);
					}
					break;
			}
		}
	};

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