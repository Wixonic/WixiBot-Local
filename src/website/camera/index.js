import { CameraManager } from "./CameraManager.js";
import { FaceTracker } from "./FaceTracker.js";
import { SceneManager } from "./SceneManager.js";
import { Avatar } from "./Avatar.js";

class App {
	constructor() {
		this.cameraManager = null;
		this.faceTracker = null;
		this.sceneManager = null;
		this.avatar = null;

		this.canvas2D = document.getElementById("canvas2D");
		this.ctx2D = this.canvas2D.getContext("2d");

		this.lastFrameTime = performance.now();
		this.isRunning = false;

		this.latestFaceData = null;
		this.isDetecting = false;

		this.loop = this.loop.bind(this);
	}

	async init() {
		this.sceneManager = new SceneManager(
			document.getElementById("canvas3D"),
			document.getElementById("canvas2D")
		);
		this.sceneManager.init();

		this.avatar = new Avatar();
		await this.avatar.init();
		if (this.avatar.head) {
			this.sceneManager.add(this.avatar.head);
		}

		const videoElement = document.querySelector("video");
		const cameraSelect = document.getElementById("camera");
		this.cameraManager = new CameraManager(videoElement, cameraSelect);
		await this.cameraManager.init();

		this.faceTracker = new FaceTracker();
		await this.faceTracker.init();

		document.body.addEventListener("click", (e) => {
			const container = document.getElementById("container");
			if (container && !container.contains(e.target)) {
				container.classList.toggle("hidden");
			}
		});

		this.isRunning = true;
		this.loop();
	}

	loop() {
		if (!this.isRunning) return;

		const now = performance.now();
		const delta = (now - this.lastFrameTime) / 1000;
		this.lastFrameTime = now;

		if (this.cameraManager.isVideoReady()) {
			const width = this.canvas2D.width;
			const height = this.canvas2D.height;

			this.ctx2D.clearRect(0, 0, width, height);

			this.ctx2D.save();
			this.ctx2D.translate(width, 0);
			this.ctx2D.scale(-1, 1);
			// this.ctx2D.drawImage(this.cameraManager.video, 0, 0, width, height); 
			this.ctx2D.restore();

			// Async Face Detection
			if (!this.isDetecting) {
				this.isDetecting = true;
				this.faceTracker.detect(this.cameraManager.video, now)
					.then(data => {
						if (data) this.latestFaceData = data;
					})
					.catch(e => {
						console.warn("Detection error:", e);
					})
					.finally(() => {
						this.isDetecting = false;
					});
			}
		}

		if (this.avatar) {
			this.avatar.update(this.latestFaceData, delta);
		}

		if (this.sceneManager) {
			this.sceneManager.render();
		}

		requestAnimationFrame(this.loop);
	}
}

addEventListener("DOMContentLoaded", async () => {
	const app = new App();
	window.app = app; // DEBUG
	await app.init();
});
