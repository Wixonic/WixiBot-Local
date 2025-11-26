import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const FACE_DETECTION_FPS = 30;

const eyeMovementCoeff = {
	x: 10,
	y: 10
};

const cameraPosition = [0, 0, 1];
const primaryDirectionalLightPosition = [4, 5, 10];
const secondaryDirectionalLightPosition = [-5, 2, 5];
const eyesInitialPosition = [0.07, 0, 0.245];

const blinkingFactor = 0.25;
const smilingFactor = 0.3;

let canvas2D, ctx2D;
let canvas3D;
let video;

let scene, camera, renderer;
let ambientLight, primaryDirectionalLight, secondaryDirectionalLight;

let head, leftEye, rightEye;
const eyeMaterials = [];
let headTargetPosition, headTargetQuaternion, leftEyeTargetPosition, rightEyeTargetPosition;

const models = {};
let lastDetect = 0;
let timestamp = 0;

const initCanvas = async () => {
	canvas2D = document.querySelector("#canvas2D");
	ctx2D = canvas2D.getContext("2d");
	canvas3D = document.querySelector("#canvas3D");

	video = document.querySelector("video");

	const cameraSelect = document.getElementById("camera");

	let devices = [];
	try {
		devices = await navigator.mediaDevices.enumerateDevices();
	} catch (e) {
		console.error("Failed to get media devices:", e);
		return;
	}

	const videoDevices = devices.filter((device) => device.kind === "videoinput");

	videoDevices.forEach((device) => {
		const option = document.createElement("option");
		option.value = device.deviceId;
		option.textContent = device.label || `Camera ${videoDevices.indexOf(device) + 1}`;
		cameraSelect.appendChild(option);
	});

	const defaultDeviceId = videoDevices[0].deviceId;
	cameraSelect.value = defaultDeviceId;

	cameraSelect.addEventListener("change", async () => {
		const selectedDeviceId = cameraSelect.value;
		await switchCamera(selectedDeviceId);
	});

	await startCamera(defaultDeviceId);

	video.addEventListener("loadedmetadata", () => video.play());
	video.addEventListener("error", (event) => {
		console.error("Video error:", event.error);
	});

	scene = new THREE.Scene();
	renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true });
	renderer.setClearAlpha(0);

	camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
	camera.position.set(...cameraPosition);
	scene.add(camera);

	ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
	primaryDirectionalLight = new THREE.DirectionalLight(0xffffff, 3);
	primaryDirectionalLight.position.set(...primaryDirectionalLightPosition);
	secondaryDirectionalLight = new THREE.DirectionalLight(0xffffff, 1);
	secondaryDirectionalLight.position.set(...secondaryDirectionalLightPosition);

	scene.add(ambientLight, primaryDirectionalLight, secondaryDirectionalLight);

	const gltfLoader = new GLTFLoader();
	head = await new Promise((resolve) => gltfLoader.load("./head.glb", (gltf) => resolve(gltf.scene.children[0])));
	head.position.set(0, 0, 0);

	const textureLoader = new THREE.TextureLoader();
	const eyeTextures = ["./eye/default/", "./eye/blink/", "./eye/happy/"];
	for (const path of eyeTextures) {
		try {
			const color = await textureLoader.loadAsync(path + "color.png");
			const alpha = await textureLoader.loadAsync(path + "alpha.png");
			eyeMaterials.push(new THREE.MeshBasicMaterial({
				map: color,
				alphaMap: alpha,
				transparent: true
			}));
		} catch (e) {
			console.error(`Failed to load texture : ${path}`, e);
		}
	}

	const eyeGeometry = new THREE.PlaneGeometry(0.1, 0.1);
	leftEye = new THREE.Mesh(eyeGeometry, eyeMaterials[0]);
	rightEye = new THREE.Mesh(eyeGeometry, eyeMaterials[0]);

	leftEye.initialPosition = new THREE.Vector3(-eyesInitialPosition[0], eyesInitialPosition[1], eyesInitialPosition[2]);
	rightEye.initialPosition = new THREE.Vector3(...eyesInitialPosition);

	leftEye.position.copy(leftEye.initialPosition);
	rightEye.position.copy(rightEye.initialPosition);

	leftEye.currentEye = rightEye.currentEye = 0;
	head.add(leftEye, rightEye);

	scene.add(head);

	const resize = () => {
		const width = innerWidth;
		const height = innerHeight;

		camera.aspect = width / height;
		camera.updateProjectionMatrix();

		renderer.setSize(width, height);
		renderer.setPixelRatio(devicePixelRatio);

		canvas3D.width = canvas2D.width = width * devicePixelRatio;
		canvas3D.height = canvas2D.height = height * devicePixelRatio;
	};

	resize();
	window.addEventListener("resize", resize);

	headTargetPosition = new THREE.Vector3(0, 0, 0);
	headTargetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler());
	leftEyeTargetPosition = new THREE.Vector3(...leftEye.initialPosition);
	rightEyeTargetPosition = new THREE.Vector3(...rightEye.initialPosition);
};

async function startCamera(deviceId) {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { deviceId: { exact: deviceId } },
			audio: false
		});

		if (video.srcObject) {
			video.srcObject.getTracks().forEach(track => track.stop());
		}

		video.srcObject = stream;
	} catch (e) {
		console.error("Failed to update camera:", e);
	}
}

async function switchCamera(deviceId) {
	await startCamera(deviceId);
}

const initModels = async () => {
	try {
		const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");

		models.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
				delegate: "GPU"
			},
			numFaces: 1,
			runningMode: "VIDEO",
			outputFaceBlendshapes: true,
			outputFacialTransformationMatrixes: true
		});
	} catch (e) {
		console.error("Models initialization failed:", e);
		setTimeout(initModels, 3000);
	}
};

let lastFrame = performance.now();
const loop = async () => {
	const now = performance.now();
	const delta = (now - lastFrame) / 1000;
	lastFrame = now;

	if (video && video.readyState >= video.HAVE_METADATA) {
		ctx2D.clearRect(0, 0, canvas2D.width, canvas2D.height);
		ctx2D.save();
		ctx2D.scale(-1, 1);
		ctx2D.drawImage(video, 0, 0, canvas2D.width, canvas2D.height);
		ctx2D.restore();

		if (now - lastDetect >= 1000 / FACE_DETECTION_FPS) {
			lastDetect = now;

			try {
				timestamp++;
				const results = await models.faceLandmarker.detectForVideo(video, timestamp);
				if (results && results.faceLandmarks.length > 0) {
					models.faceLandmarker.result = results;
				} else {
					console.warn("Aucun visage détecté.");
				}
			} catch (e) {
				console.warn("Face landmarker error:", e);
				if (e.message.includes("Unset") || e.message.includes("call_indirect")) {
					console.error("Réinitialisation du modèle...");
					setTimeout(initModels, 2000);
				}
			}
		}

		const scale = Math.min(canvas2D.width, canvas2D.height) / 500 * devicePixelRatio;

		const log = [];

		if (models.faceLandmarker && models.faceLandmarker.result) {
			const face = {
				landmarks: models.faceLandmarker.result.faceLandmarks[0],
				blendShapes: models.faceLandmarker.result.faceBlendshapes[0],
				matrix: models.faceLandmarker.result.facialTransformationMatrixes[0]
			};

			if (face.landmarks) {
				const eyeRange = (left, right) => {
					return {
						left: face.landmarks[left],
						right: face.landmarks[right],
						get top() {
							return {
								x: this.leftAndRightMiddle.x,
								y: this.leftAndRightMiddle.y - this.leftAndRightDistance.x / 4
							};
						},
						get bottom() {
							return {
								x: this.leftAndRightMiddle.x,
								y: this.leftAndRightMiddle.y - this.leftAndRightDistance.x / 8
							};
						},
						get leftAndRightMiddle() {
							return {
								x: (this.left.x + this.right.x) / 2,
								y: (this.left.y + this.right.y) / 2
							};
						},
						get leftAndRightDistance() {
							return {
								x: Math.abs(this.left.x - this.right.x),
								y: Math.abs(this.left.y - this.right.y)
							};
						},
						get topAndBottomMiddle() {
							return {
								x: (this.top.x + this.bottom.x) / 2,
								y: (this.top.y + this.bottom.y) / 2
							};
						},
						get topAndBottomDistance() {
							return {
								x: Math.abs(this.top.x - this.bottom.x),
								y: Math.abs(this.top.y - this.bottom.y)
							};
						}
					};
				};

				const getClampedIrisOffset = (iris, range) => {
					const x = range.leftAndRightMiddle.x - iris.x;
					const y = range.topAndBottomMiddle.y - iris.y;

					return {
						x: Math.min(Math.max(x * eyeMovementCoeff.x, -0.05), 0.05),
						y: Math.min(Math.max(y * eyeMovementCoeff.y, -0.03), 0.03),
					};
				};

				const leftIris = face.landmarks[473];
				const leftEyeRange = eyeRange(362, 263);
				const leftOffset = getClampedIrisOffset(leftIris, leftEyeRange);

				leftEyeTargetPosition.set(
					leftEye.initialPosition.x + leftOffset.x,
					leftEye.initialPosition.y + leftOffset.y,
					leftEye.initialPosition.z
				);

				const rightIris = face.landmarks[468];
				const rightEyeRange = eyeRange(133, 33);
				const rightOffset = getClampedIrisOffset(rightIris, rightEyeRange);

				rightEyeTargetPosition.set(
					rightEye.initialPosition.x + rightOffset.x,
					rightEye.initialPosition.y + rightOffset.y,
					rightEye.initialPosition.z
				);

				/* ctx2D.fillStyle = "lime";
				for (const landmark of face.landmarks) {
					const x = canvas2D.width - (landmark.x * canvas2D.width);
					const y = landmark.y * canvas2D.height;
					ctx2D.fillRect(x - 0.5 * scale, y - 0.5 * scale, 0.5 * scale, 0.5 * scale);
				} */
			}

			if (face.blendShapes?.categories) {
				const blinkLeft = face.blendShapes.categories[9]?.score || 0;
				const blinkRight = face.blendShapes.categories[10]?.score || 0;
				const smile = (face.blendShapes.categories[44]?.score + face.blendShapes.categories[45]?.score) / 2 || 0;

				const isBlinking = blinkLeft > blinkingFactor || blinkRight > blinkingFactor;
				const isSmiling = !isBlinking && smile > smilingFactor;

				const targetEye = isSmiling ? 2 : (isBlinking ? 1 : 0);

				if (leftEye.currentEye !== targetEye) {
					leftEye.currentEye = targetEye;
					leftEye.material = eyeMaterials[targetEye];
				}

				if (rightEye.currentEye !== targetEye) {
					rightEye.currentEye = targetEye;
					rightEye.material = eyeMaterials[targetEye];
				}
			}

			if (face.matrix?.data) {
				const m = face.matrix.data;
				headTargetPosition = new THREE.Vector3(
					Math.min(Math.max(-m[12], -15), 15) / 15,
					Math.min(Math.max(m[13], -12), 12) / 25,
					Math.min((m[14] + 45) / 15, 0.5)
				);

				const headTargetRotation = new THREE.Euler(
					-Math.atan2(m[9], m[10]) + 0.2,
					Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10])),
					Math.atan2(m[4], m[0])
				);
				headTargetQuaternion = new THREE.Quaternion().setFromEuler(headTargetRotation);
			}
		}

		ctx2D.fillStyle = "white";
		ctx2D.font = `${4 * scale}px Arial`;
		ctx2D.fillText(log.join(" · "), 0, 5 * scale);
	}

	const eyeBaseCoeff = 0.1;
	const headPositionBaseCoeff = 0.05;
	const headQuaternionBaseCoeff = 0.15;

	const eyeLerpAlpha = 1 - Math.pow(1 - eyeBaseCoeff, delta * 60);
	const headPositionLerpAlpha = 1 - Math.pow(1 - headPositionBaseCoeff, delta * 60);
	const headQuaternionLerpAlpha = 1 - Math.pow(1 - headQuaternionBaseCoeff, delta * 60);

	leftEye.position.lerp(leftEyeTargetPosition, eyeLerpAlpha);
	rightEye.position.lerp(rightEyeTargetPosition, eyeLerpAlpha);
	head.position.lerp(headTargetPosition, headPositionLerpAlpha);
	head.quaternion.slerp(headTargetQuaternion, headQuaternionLerpAlpha);

	renderer.render(scene, camera);
	requestAnimationFrame(loop);
};

addEventListener("DOMContentLoaded", async () => {
	await initCanvas();
	await initModels();
	loop();
});
