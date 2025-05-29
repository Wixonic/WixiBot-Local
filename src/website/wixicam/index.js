import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";
import * as THREE from "https://cdn.jsdelivr.net/npm/three/build/three.module.min.js";

const CAM_NAME = "Caméra du MacBook Pro";

let video;
let canvas;
let ctx;
let models = {};

const connectCamera = async () => {
	const devices = await navigator.mediaDevices.enumerateDevices();
	const cam = devices.find((d) => d.kind == "videoinput" && d.label == CAM_NAME);
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
			modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
		},
		runningMode: "VIDEO",
		outputFaceBlendshapes: true,
		outputFacialTransformationMatrixes: true
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

	if (models.faceLandmarker) {
		const result = await models.faceLandmarker.detectForVideo(video, performance.now());

		if (!window.logged) {
			console.log(result);
			window.logged = true;
		}

		for (let i = 0; i < Math.min(result.faceLandmarks.length, result.faceBlendshapes.length, result.facialTransformationMatrixes.length); ++i) {
			const face = {
				x: 0,
				y: 0,
				landmarks: result.faceLandmarks[i],
				blendShapes: result.faceBlendshapes[i],
				matrix: result.facialTransformationMatrixes[i],
				text: []
			};

			ctx.strokeWidth = 0;
			for (const landmark of face.landmarks) {
				ctx.fillStyle = "lime";
				const x = landmark.x * width;
				const y = landmark.y * height;
				const size = 1 * scale;
				ctx.fillRect(x - size / 2, y - size / 2, size, size);
			}

			const blinkLeft = face.blendShapes.categories[9].score;
			const blinkRight = face.blendShapes.categories[10].score;
			const smile = (face.blendShapes.categories[44].score + face.blendShapes.categories[45].score) / 2;
			const browDown = (face.blendShapes.categories[1].score + face.blendShapes.categories[2].score) / 2;
			const browUp = face.blendShapes.categories[3].score;

			if (blinkLeft > 0.4) face.text.push("Left eye closed");
			if (blinkRight > 0.35) face.text.push("Right eye closed");

			if (smile > 0.5) face.text.push("Joy");
			else if (browUp > 0.1) face.text.push("Surprise");
			else if (browDown > 0.3) face.text.push("Angry");
			else if (browDown > 0.1) face.text.push("Perplex");

			const m = face.matrix.data;

			const rotX = Math.atan2(m[9], m[10]);
			const rotY = Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10]));
			const rotZ = Math.atan2(m[4], m[0]);

			face.text.push(`Rot X: ${rotX.toFixed(2)}`, `Rot Y: ${rotY.toFixed(2)}`, `Rot Z: ${rotZ.toFixed(2)}`);

			ctx.fillStyle = "lime";
			ctx.font = "16px Arial";
			ctx.fillText(face.text.join(" "), face.x, face.y + 16);
		}
	};

	setTimeout(draw, 1000 / 30);
};

addEventListener("DOMContentLoaded", async () => {
	canvas = document.querySelector("canvas");
	ctx = canvas.getContext("2d");

	await connectCamera();
	await initModels();
	draw();
});