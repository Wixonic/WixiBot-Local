export class AudioManager {
	constructor(selectElement) {
		this.selectElement = selectElement;
		this.audioContext = null;
		this.analyser = null;
		this.microphone = null;
		this.dataArray = null;
		this.stream = null;
	}

	async init() {
		try {
			this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

			await this.setDevice(null);
			await this.enumerateDevices();

			const savedDeviceId = localStorage.getItem("selectedMicrophoneId");
			if (savedDeviceId) {
				const options = Array.from(this.selectElement.options);
				const deviceExists = options.some(opt => opt.value === savedDeviceId);
				if (deviceExists) {
					this.selectElement.value = savedDeviceId;
					await this.setDevice(savedDeviceId);
				}
			}

			this.selectElement.addEventListener("change", async (e) => {
				await this.setDevice(e.target.value);
				localStorage.setItem("selectedMicrophoneId", e.target.value);
			});
		} catch (error) {
			console.error("Error initializing Audio Manager:", error);
		}
	}

	async enumerateDevices() {
		this.selectElement.innerHTML = "";
		const devices = await navigator.mediaDevices.enumerateDevices();
		const audioDevices = devices.filter((device) => device.kind === "audioinput");

		audioDevices.forEach(device => {
			const option = document.createElement("option");
			option.value = device.deviceId;
			option.text = device.label || `Microphone ${this.selectElement.length + 1}`;
			this.selectElement.appendChild(option);
		});
	}

	async setDevice(deviceId) {
		if (this.stream) {
			this.stream.getTracks().forEach((track) => track.stop());
		}

		try {
			const constraints = {
				audio: {
					deviceId: deviceId ? { exact: deviceId } : undefined
				}
			};

			this.stream = await navigator.mediaDevices.getUserMedia(constraints);
			this.microphone = this.audioContext.createMediaStreamSource(this.stream);
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 256;
			this.microphone.connect(this.analyser);
			this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

			if (this.audioContext.state === "suspended") {
				await this.audioContext.resume();
			}
		} catch (error) {
			console.error("Error setting audio device:", error);
		}
	}

	getVolume() {
		if (!this.analyser || !this.dataArray) return 0;

		this.analyser.getByteFrequencyData(this.dataArray);

		let sum = 0;
		for (let i = 0; i < this.dataArray.length; i++) {
			sum += this.dataArray[i];
		}

		const average = sum / this.dataArray.length;
		return Math.min(average / 128, 1);
	}
}
