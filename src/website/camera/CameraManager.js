export class CameraManager {
	constructor(videoElement, selectElement) {
		this.video = videoElement;
		this.select = selectElement;
		this.currentDeviceId = null;

		this.video.addEventListener("loadedmetadata", () => {
			this.video.play().catch(e => console.error("Auto-play failed:", e));
		});

		if (this.select) {
			this.select.addEventListener("change", async () => {
				await this.startCamera(this.select.value);
			});
		}
	}

	async init() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true
			});
			this._stopStream(this.video.srcObject);
			this.video.srcObject = null;
		} catch (e) {
			console.error("Failed to get camera permission:", e);
			throw e;
		}

		await this._enumerateDevices();

		if (this.select && this.select.options.length > 0) {
			await this.startCamera(this.select.value);
		} else {
			await this.startCamera();
		}
	}

	async _enumerateDevices() {
		if (!this.select) return;

		let devices = [];
		try {
			devices = await navigator.mediaDevices.enumerateDevices();
		} catch (e) {
			console.error("Failed to list devices:", e);
			return;
		}

		const videoDevices = devices.filter((device) => device.kind === "videoinput");

		this.select.innerHTML = "";

		videoDevices.forEach((device, index) => {
			const option = document.createElement("option");
			option.value = device.deviceId;
			option.textContent = device.label || `Camera ${index + 1}`;
			this.select.appendChild(option);
		});
	}

	async startCamera(deviceId = null) {
		if (this.video.srcObject) {
			this._stopStream(this.video.srcObject);
		}

		const constraints = {
			video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } },
			audio: false
		};

		try {
			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			this.video.srcObject = stream;

			await new Promise((resolve) => {
				if (this.video.readyState >= this.video.HAVE_METADATA) {
					resolve();
				} else {
					this.video.onloadedmetadata = () => resolve();
				}
			});

			this.currentDeviceId = deviceId;

			if (this.select && this.select.value !== deviceId && deviceId) {
				this.select.value = deviceId;
			}

		} catch (e) {
			console.error("Failed to start camera:", e);
		}
	}

	_stopStream(stream) {
		if (stream) {
			stream.getTracks().forEach(track => track.stop());
		}
	}

	isVideoReady() {
		return this.video && this.video.readyState >= this.video.HAVE_METADATA;
	}
}