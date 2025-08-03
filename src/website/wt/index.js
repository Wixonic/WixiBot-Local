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

let lastClick;

const camera = {
	position: [0, 0],
	moving: false,
	zoom: 1,

	keepInside: () => {
		camera.position[0] = Math.max(Math.min(camera.position[0], 0), canvas.width - canvas.width * camera.zoom);
		camera.position[1] = Math.max(Math.min(camera.position[1], 0), canvas.height - canvas.height * camera.zoom);
	}
};

const canvasToWorldCoordinates = (x, y, info) => {
	if (Array.isArray(x)) {
		y = x[1];
		x = x[0];
	}

	const [w, h] = [info.map_max[0] - info.map_min[0], info.map_max[1] - info.map_min[1]];

	return [
		((x - camera.position[0]) / canvas.width / camera.zoom) * w + info.map_min[0],
		((y - camera.position[1]) / canvas.height / camera.zoom) * h + info.map_min[1]
	];
};

const worldToCanvasCoordinates = (x, y, info, translate = true) => {
	if (Array.isArray(x)) {
		y = x[1];
		x = x[0];
	}

	if (translate) {
		x -= info.map_min[0];
		y -= info.map_min[1];
	}

	return [
		(x / (info.map_max[0] - info.map_min[0])) * canvas.width * camera.zoom + (translate ? camera.position[0] : 0),
		(y / (info.map_max[1] - info.map_min[1])) * canvas.height * camera.zoom + (translate ? camera.position[1] : 0)
	];
};

const gridToCanvasCoordinates = (x, y, info, translate) => {
	if (Array.isArray(x)) {
		y = x[1];
		x = x[0];
	}

	const [w, h] = [info.map_max[0] - info.map_min[0], info.map_max[1] - info.map_min[1]];

	x += info.map_min[0] / w;
	y += info.map_min[1] / h;

	return worldToCanvasCoordinates(x * w, y * h, info, translate);
};

const gridToWorldCoordinates = (x, y, info, translate) => gridToCanvasCoordinates(canvasToWorldCoordinates(x, y, info), null, info, translate);

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

			canvas.width = width;
			canvas.height = height;
			ctx.clearRect(0, 0, width, height);

			ctx.font = `${10 * devicePixelRatio}px Arial`;

			const [sx, sy] = worldToCanvasCoordinates(info.map_min, null, data.info);
			const [ex, ey] = worldToCanvasCoordinates(info.map_max, null, data.info);
			ctx.drawImage(map, sx, sy, ex - sx, ey - sy);

			ctx.beginPath();

			const steps = worldToCanvasCoordinates(info.grid_steps, null, data.info, false);
			for (let x = camera.position[0] % steps[0]; x <= width; x += steps[0]) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
			for (let y = camera.position[1] % steps[1]; y <= height; y += steps[1]) { ctx.moveTo(0, y); ctx.lineTo(width, y); }

			ctx.strokeStyle = "#000";
			ctx.lineWidth = drawSize;
			ctx.stroke();

			const s = drawSize * 10;

			for (const obj of objects) {
				ctx.fillStyle = obj.color;
				ctx.lineWidth = drawSize;

				const [x, y] = gridToCanvasCoordinates(obj.x ?? 0, obj.y ?? 0, data.info);
				const [sx, sy] = gridToCanvasCoordinates(obj.sx ?? 0, obj.sy ?? 0, data.info);
				const [ex, ey] = gridToCanvasCoordinates(obj.ex ?? 0, obj.ey ?? 0, data.info);

				switch (obj.type) {
					case "airfield":
						{
							const s = drawSize * 3;

							ctx.save();
							ctx.lineWidth = s + drawSize;
							ctx.beginPath();
							ctx.moveTo(sx, sy);
							ctx.lineTo(ex, ey);
							ctx.closePath();
							ctx.stroke();
							ctx.restore();

							ctx.save();
							ctx.strokeStyle = ctx.fillStyle;
							ctx.lineWidth = s;
							ctx.beginPath();
							ctx.moveTo(sx, sy);
							ctx.lineTo(ex, ey);
							ctx.closePath();
							ctx.stroke();
							ctx.restore();
						}
						break;
				}

				switch (obj.icon) {
					case "Player":
						{
							const s = drawSize * 8;
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
							const s = drawSize * 10;
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

					case "bombing_point":
						{
							const sL = drawSize * 25;
							const sl = drawSize * 2.5;

							for (let i = 1; i <= 2; ++i) {
								const radius = sL / i / 2;

								ctx.beginPath();
								ctx.arc(x, y, radius, 0, Math.PI * 2);
								ctx.arc(x, y, radius - sl, 0, Math.PI * 2);
								ctx.closePath();

								ctx.fill("evenodd");
								ctx.stroke();

								ctx.save();
								ctx.strokeStyle = ctx.fillStyle;
								ctx.lineWidth = sl;
								ctx.beginPath();
								ctx.arc(x, y, radius - sl / 2, 0, Math.PI * 2);
								ctx.stroke();
								ctx.restore();
							}

							ctx.beginPath();

							ctx.moveTo(x + sL / 16, y - sl / 4);
							ctx.lineTo(x + sL / 2, y - sl / 4);
							ctx.lineTo(x + sL / 2, y + sl / 4);
							ctx.lineTo(x + sL / 16, y + sl / 4);

							ctx.moveTo(x - sL / 16, y - sl / 4);
							ctx.lineTo(x - sL / 2, y - sl / 4);
							ctx.lineTo(x - sL / 2, y + sl / 4);
							ctx.lineTo(x - sL / 16, y + sl / 4);

							ctx.moveTo(x - sl / 4, y - sL / 16);
							ctx.lineTo(x - sl / 4, y - sL / 2);
							ctx.lineTo(x + sl / 4, y - sL / 2);
							ctx.lineTo(x + sl / 4, y - sL / 16);

							ctx.moveTo(x + sl / 4, y + sL / 16);
							ctx.lineTo(x + sl / 4, y + sL / 2);
							ctx.lineTo(x - sl / 4, y + sL / 2);
							ctx.lineTo(x - sl / 4, y + sL / 16);

							ctx.closePath();

							ctx.fill();
						}
						break;

					case "defending_point":
						{
							const s = drawSize * 10;
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

					case "respawn_base_fighter":
						{
							const s = drawSize * 1.5;
							ctx.fillRect(x - s / 2, y - s / 2, s, s);
						}
						break;

					case "respawn_base_bomber":
						{
							const s = drawSize * 1.5;
							ctx.fillRect(x - s / 2, y - s / 2, s, s);
						}
						break;

					case "Ground":
						{
							const s = drawSize * 5;
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 2);
							ctx.lineTo(x + s / 2, y - s / 2);
							ctx.lineTo(x + s / 2, y + s / 2);
							ctx.lineTo(x - s / 2, y + s / 2);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "Tracked":
						{
							const s = drawSize * 5;
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 2);
							ctx.lineTo(x + s / 2, y - s / 2);
							ctx.lineTo(x + s / 2, y + s / 2);
							ctx.lineTo(x - s / 2, y + s / 2);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "Wheeled":
						{
							const s = drawSize * 6;
							ctx.beginPath();
							ctx.arc(x, y, s / 2, 0, Math.PI * 2);
							ctx.closePath();
							ctx.fill("evenodd");
							ctx.stroke();
						}
						break;

					case "LightTank":
						{
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 5);
							ctx.lineTo(x + s / 2, y - s / 5);
							ctx.lineTo(x + s / 2, y + s / 5);
							ctx.lineTo(x - s / 2, y + s / 5);
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

					case "TankDestroyer":
						{

						}
						break;

					case "SPAA":
						{
							const s = drawSize * 8;
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

					case "Fighter":
						{
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y);
							ctx.lineTo(x, y + s / 2);
							ctx.lineTo(x + s / 2, y);
							ctx.lineTo(x, y - s / 2);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "Assault":
						{
							const s = drawSize * 12;
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y);
							ctx.lineTo(x, y + s / 4);
							ctx.lineTo(x + s / 2, y);
							ctx.lineTo(x, y - s / 4);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "Bomber":
						{
							const s = drawSize * 8;
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y);
							ctx.lineTo(x - s / 2, y - s / 2);
							ctx.lineTo(x + s / 2, y - s / 2);
							ctx.lineTo(x + s / 2, y);
							ctx.lineTo(x, y + s / 2);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "Ship":
						{
							const s = drawSize * 8;
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 5);

							ctx.lineTo(x, y - s / 5);
							ctx.lineTo(x - s / 2, y - s / 1.5);
							ctx.lineTo(x + s / 2, y - s / 1.5);
							ctx.lineTo(x, y - s / 5);

							ctx.lineTo(x + s / 2, y - s / 5);
							ctx.lineTo(x + s / 2, y + s / 5);
							ctx.lineTo(x - s / 2, y + s / 5);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "TorpedoBoat":
						{
							const s = drawSize * 8;
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 5);

							ctx.lineTo(x, y - s / 5);
							ctx.lineTo(x - s / 2, y - s / 1.5);
							ctx.lineTo(x + s / 2, y - s / 1.5);
							ctx.lineTo(x, y - s / 5);

							ctx.lineTo(x + s / 2, y - s / 5);
							ctx.lineTo(x + s / 2, y + s / 5);
							ctx.lineTo(x - s / 2, y + s / 5);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					case "Boat":
						{
							const s = drawSize * 8;
							ctx.beginPath();
							ctx.moveTo(x - s / 2, y - s / 5);

							ctx.lineTo(x, y - s / 5);
							ctx.lineTo(x - s / 2, y - s / 1.5);
							ctx.lineTo(x + s / 2, y - s / 1.5);
							ctx.lineTo(x, y - s / 5);

							ctx.lineTo(x + s / 2, y - s / 5);
							ctx.lineTo(x + s / 2, y + s / 5);
							ctx.lineTo(x - s / 2, y + s / 5);
							ctx.closePath();
							ctx.fill();
							ctx.stroke();
						}
						break;

					default:
						{
							ctx.fillStyle = "#F0F";
							ctx.lineWidth = 0;
							ctx.fillRect(x - s / 4, y - s / 4, s / 2, s / 2);
						}
						break;
				}

				ctx.restore();
			}

			if (lastClick) {
				const player = objects.find((obj) => obj.icon == "Player");
				if (!window.logged) {
					window.logged = true;
					console.log(player);
				}

				if (player) {
					const [pcx, pcy] = gridToCanvasCoordinates(player.x, player.y, data.info);
					const [px, py] = gridToWorldCoordinates(player.x, player.y, data.info);
					const [cx, cy] = worldToCanvasCoordinates(lastClick, null, data.info);

					const dx = lastClick[0] - px;
					const dy = lastClick[1] - py;
					const dist = Math.hypot(dx, dy);

					const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90) % 360;

					ctx.beginPath();
					ctx.moveTo(pcx, pcy);
					ctx.lineTo(cx, cy);
					ctx.strokeStyle = "#F00";
					ctx.lineWidth = 2;
					ctx.stroke();

					ctx.fillStyle = "#FFF";
					ctx.fillText(
						`Dist: ${Math.round(dist)} | ${angle.toFixed(1)}°`,
						cx + 5,
						cy - 5
					);
				}
			}
		};
	} catch (e) {
		console.error(e);
		lastClick = null;
		await wait(1000);
	}

	requestAnimationFrame(draw);
};

addEventListener("DOMContentLoaded", () => {
	canvas = document.querySelector("canvas");
	ctx = canvas.getContext("2d");

	ctx.imageSmoothingEnabled = false;
	canvas.style.imageRendering = "pixelated";

	canvas.addEventListener("click", event => {
		if (data && data.info && data.objects && map) {
			const rect = canvas.getBoundingClientRect();
			const cx = (event.clientX - rect.left) * devicePixelRatio;
			const cy = (event.clientY - rect.top) * devicePixelRatio;
			lastClick = canvasToWorldCoordinates(cx, cy, data.info);
		}
	});

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