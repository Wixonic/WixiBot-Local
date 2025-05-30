import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const CAMERA_NAME = "Caméra du MacBook";
const SERVER_URL = "ws://localhost:1000/";
const FACE_DETECTION_FPS = 30;

let canvas2D, ctx2D;
let canvas3D;

let video, mediaSource, sourceBuffer;

let ws;

let scene, camera, renderer;
let ambientLight, primaryDirectionalLight, secondaryDirectionalLight;

let head, leftEye, rightEye, body, leftArm, rightArm;

let models = {};
let lastDetect = 0;

const initCanvas = async () => {
	canvas2D = document.querySelector("#canvas2D");
	ctx2D = canvas2D.getContext("2d");
	canvas3D = document.querySelector("#canvas3D");

	scene = new THREE.Scene();
	renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true });

	camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
	camera.position.set(0, 0, 1);
	scene.add(camera);

	ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

	primaryDirectionalLight = new THREE.DirectionalLight(0xffffff, 3);
	primaryDirectionalLight.position.set(4, 5, 10);

	secondaryDirectionalLight = new THREE.DirectionalLight(0xffffff, 1);
	secondaryDirectionalLight.position.set(-5, 2, 5);

	scene.add(ambientLight, primaryDirectionalLight, secondaryDirectionalLight);

	const loader = new GLTFLoader();
	head = await new Promise((resolve) => loader.load("./head.glb", (gltf) => resolve(gltf.scene.children[0])));
	head.position.set(0, 0, 0);
	scene.add(head);

	const resize = () => {
		const ratio = 640 / 480;
		let width = window.innerWidth;
		let height = width / ratio;

		if (height > window.innerHeight) {
			height = window.innerHeight;
			width = height * ratio;
		}

		camera.aspect = width / height;
		camera.updateProjectionMatrix();

		renderer.setSize(width, height);
		renderer.setPixelRatio(devicePixelRatio);

		canvas3D.width = canvas2D.width = width * devicePixelRatio;
		canvas3D.height = canvas2D.height = height * devicePixelRatio;
	};

	video = document.querySelector("video");
	video.addEventListener("loadedmetadata", () => video.play());

	resize();
	window.addEventListener("resize", resize);
};

const connectCamera = async () => {
	const devices = await navigator.mediaDevices.enumerateDevices();
	const cameraDevice = devices.find((d) => d.kind == "videoinput" && d.label.startsWith(CAMERA_NAME));

	if (!cameraDevice) {
		console.error("Camera device not found");
		setTimeout(connectCamera, 2000);
		return;
	}

	console.log("Using device:", cameraDevice.label);

	ws = new WebSocket(SERVER_URL);
	ws.binaryType = "arraybuffer";

	ws.addEventListener("open", () => ws.send(new Uint8Array([0x02])));
	ws.addEventListener("message", (event) => {
		if (new Uint8Array(event.data)[0] == 0x00) {
			console.log("Initializing media source...");

			mediaSource = new MediaSource();

			mediaSource.addEventListener("sourceopen", () => {
				console.log("Initializing source buffer...");

				sourceBuffer = mediaSource.addSourceBuffer(`video/mp4; codecs="avc1.42E01E"`);

				mediaSource.duration = Infinity;
				sourceBuffer.mode = "sequence";

				let queue = [];
				let updating = false;

				sourceBuffer.addEventListener("updateend", () => {
					updating = false;
					if (queue.length > 0) {
						updating = true;
						sourceBuffer.appendBuffer(queue.shift());
					}
				});

				ws.addEventListener("message", (event) => {
					const chunk = new Uint8Array(event.data);
					if (updating || sourceBuffer.updating || mediaSource.readyState != "open") queue.push(chunk);
					else {
						updating = true;
						sourceBuffer.appendBuffer(chunk);
					}
				});

				ws.send(cameraDevice.label);
			});

			video.src = URL.createObjectURL(mediaSource);
		} else console.error("Handshake failed:", data);
	}, { once: true });

	ws.addEventListener("close", reconnect);
};

const drawLoop = async () => {
	if (video.readyState >= 2) {
		ctx2D.clearRect(0, 0, canvas2D.width, canvas2D.height);

		const now = performance.now();
		if (now - lastDetect >= 1000 / FACE_DETECTION_FPS) {
			lastDetect = now;
			if (!models.faceLandmarker) return;

			try {
				models.faceLandmarker.result = await models.faceLandmarker.detectForVideo(video, performance.now());
			} catch (e) {
				console.warn("Face detection error:", e);
			}
		}

		const scale = Math.min(canvas2D.width, canvas2D.height) / 500 * devicePixelRatio;

		for (let i = 0; i < Math.min(
			models.faceLandmarker.result.faceLandmarks.length,
			models.faceLandmarker.result.faceBlendshapes.length,
			models.faceLandmarker.result.facialTransformationMatrixes.length
		); i++) {
			const face = {
				landmarks: models.faceLandmarker.result.faceLandmarks[i],
				blendShapes: models.faceLandmarker.result.faceBlendshapes[i],
				matrix: models.faceLandmarker.result.facialTransformationMatrixes[i]
			};

			/* ctx2D.fillStyle = "lime";
			for (const landmark of face.landmarks) {
				const x = canvas2D.width - (landmark.x * canvas2D.width);
				const y = landmark.y * canvas2D.height;
				ctx2D.fillRect(x - 0.5 * scale, y - 0.5 * scale, 0.5 * scale, 0.5 * scale);
			} */

			const expressions = [];
			const blinkLeft = face.blendShapes.categories[9].score;
			const blinkRight = face.blendShapes.categories[10].score;
			const smile = (face.blendShapes.categories[44].score + face.blendShapes.categories[45].score) / 2;
			const browDown = (face.blendShapes.categories[1].score + face.blendShapes.categories[2].score) / 2;
			const browUp = face.blendShapes.categories[3].score;

			if (blinkLeft > 0.4) expressions.push("Left eye closed");
			if (blinkRight > 0.35) expressions.push("Right eye closed");
			if (smile > 0.4) expressions.push("Joy");
			else if (browUp > 0.1) expressions.push("Surprise");
			else if (browDown > 0.4) expressions.push("Angry");
			else if (browDown > 0.15) expressions.push("Perplex");

			const m = face.matrix.data;
			const targetPosition = new THREE.Vector3(
				Math.min(Math.max(-m[12], -10), 10) / 20,
				Math.min(Math.max(m[13], -8), 8) / 20,
				Math.min((m[14] + 50) / 15, 0.5)
			);

			head.position.lerp(targetPosition, 0.02);

			const targetRotation = new THREE.Euler(
				-Math.atan2(m[9], m[10]) + 0.2,
				Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10])),
				Math.atan2(m[4], m[0])
			);

			const targetQuaternion = new THREE.Quaternion().setFromEuler(targetRotation);
			head.quaternion.slerp(targetQuaternion, 0.15);

			ctx2D.fillStyle = "white";
			ctx2D.font = `${4 * scale}px Arial`;
			ctx2D.fillText(expressions.join(" · "), 0, 5 * scale);
		}
	}

	renderer.render(scene, camera);

	requestAnimationFrame(drawLoop);
};

const reconnect = async () => {
	await new Promise((resolve) => setTimeout(resolve, 2000));
	connectCamera();
};

const initModels = async () => {
	try {
		const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");

		models.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
				delegate: "CPU"
			},
			runningMode: "VIDEO",
			outputFaceBlendshapes: true,
			outputFacialTransformationMatrixes: true
		});
	} catch (e) {
		console.error("Model initialization failed:", e);
		setTimeout(initModels, 3000);
	}
};

addEventListener("DOMContentLoaded", async () => {
	await initCanvas();
	connectCamera();
	initModels();
	drawLoop();
});