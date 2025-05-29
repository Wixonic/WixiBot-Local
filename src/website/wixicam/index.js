import {
	FilesetResolver,
	FaceLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const CAM_NAME = "Caméra du MacBook Pro";

let model;
let video;
let canvas;
let ctx;
let models = {};

const connectCamera = async () => {
	const devices = await navigator.mediaDevices.enumerateDevices();
	const cam = devices.find((d) => d.kind === "videoinput" && d.label.includes(CAM_NAME));

	const stream = await navigator.mediaDevices.getUserMedia({
		video: cam ? { deviceId: { exact: cam.deviceId } } : true,
	});

	video = document.createElement("video");
	video.autoplay = true;
	video.playsInline = true;
	video.srcObject = stream;
	await video.play();
};

const initModels = async () => {
	const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");

	models.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
		baseOptions: {
			modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
		},
		runningMode: "VIDEO",
		outputFaceBlendshapes: true,
		outputFacialTransformationMatrixes: false
	});
};

const draw = async () => {
	const ratio = video.videoWidth / video.videoHeight;

	let width = innerWidth;
	let height = innerWidth / ratio;

	if (height > innerHeight) {
		height = innerHeight;
		width = innerHeight * ratio;
	}

	const scale = Math.min(width, height) / 500;

	canvas.width = width;
	canvas.height = height;

	ctx.drawImage(video, 0, 0, width, height);

	if (models.faceLandmarker) {
		const result = await models.faceLandmarker.detectForVideo(video, performance.now());
		if (!window.logged && result.faceBlendshapes.length > 0) {
			window.logged = true;
			console.log(JSON.stringify(result));
		}

		ctx.strokeWidth = 0;
		for (const face of result.faceLandmarks) {
			for (const landmark of face) {
				ctx.fillStyle = "lime";
				const x = landmark.x * width;
				const y = landmark.y * height;
				const size = 1 * scale;
				ctx.fillRect(x - size / 2, y - size / 2, size, size);
			}
		}

		for (const face of result.faceBlendshapes) {
			const blinkLeft = face.categories[9].score > 0.5;
			const blinkRight = face.categories[10].score > 0.5;

			document.body.style.background = blinkLeft && blinkRight ? "#00F" : (blinkLeft ? "#0F0" : (blinkRight ? "#F00" : "#000"));
		}
	}

	setTimeout(draw, 1000 / 30);
};

addEventListener("DOMContentLoaded", async () => {
	canvas = document.querySelector("canvas");
	ctx = canvas.getContext("2d");

	await connectCamera();
	await initModels();
	draw();
});