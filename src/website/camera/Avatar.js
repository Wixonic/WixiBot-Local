import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class Avatar {
	constructor() {
		this.head = null;
		this.leftEye = null;
		this.rightEye = null;
		this.eyeMaterials = [];

		// Constants
		this.eyesInitialPosition = new THREE.Vector3(0.07, 0, 0.245);
		this.eyeMovementCoeff = { x: 10, y: 10 };
		this.blinkingFactor = 0.25;
		this.smilingFactor = 0.3;

		// Lerp Coeffs
		this.eyeBaseCoeff = 0.1;
		this.headPositionBaseCoeff = 0.05;
		this.headQuaternionBaseCoeff = 0.15;

		// State targets
		this.headTargetPosition = new THREE.Vector3();
		this.headTargetQuaternion = new THREE.Quaternion();
		this.leftEyeTargetPosition = new THREE.Vector3();
		this.rightEyeTargetPosition = new THREE.Vector3();

		// Caching vectors to avoid allocation in loop
		this.dummyVector = new THREE.Vector3();
	}

	async init() {
		await this._loadModel();
		await this._loadTextures();
		this._setupEyes();

		// Initialize targets
		this.leftEyeTargetPosition.copy(this.leftEye.position);
		this.rightEyeTargetPosition.copy(this.rightEye.position);
	}

	async _loadModel() {
		const gltfLoader = new GLTFLoader();
		const gltf = await new Promise((resolve, reject) =>
			gltfLoader.load("./head.glb", resolve, undefined, reject)
		);
		this.head = gltf.scene.children[0];
		this.head.position.set(0, 0, 0);
	}

	async _loadTextures() {
		const textureLoader = new THREE.TextureLoader();
		const paths = ["./eye/default/", "./eye/blink/", "./eye/happy/"];

		for (const path of paths) {
			try {
				const [color, alpha] = await Promise.all([
					textureLoader.loadAsync(path + "color.png"),
					textureLoader.loadAsync(path + "alpha.png")
				]);

				this.eyeMaterials.push(new THREE.MeshBasicMaterial({
					map: color,
					alphaMap: alpha,
					transparent: true
				}));
			} catch (e) {
				console.error(`Failed to load texture ${path}:`, e);
				this.eyeMaterials.push(new THREE.MeshBasicMaterial({ color: 0xff0000 }));
			}
		}
	}

	_setupEyes() {
		const eyeGeometry = new THREE.PlaneGeometry(0.1, 0.1);
		this.leftEye = new THREE.Mesh(eyeGeometry, this.eyeMaterials[0]);
		this.rightEye = new THREE.Mesh(eyeGeometry, this.eyeMaterials[0]);

		// Store initial positions relative to parent (Head)
		this.leftEye.initialX = -this.eyesInitialPosition.x;
		this.leftEye.initialY = this.eyesInitialPosition.y;
		this.leftEye.initialZ = this.eyesInitialPosition.z;

		this.rightEye.initialX = this.eyesInitialPosition.x;
		this.rightEye.initialY = this.eyesInitialPosition.y;
		this.rightEye.initialZ = this.eyesInitialPosition.z;

		this.leftEye.position.set(this.leftEye.initialX, this.leftEye.initialY, this.leftEye.initialZ);
		this.rightEye.position.set(this.rightEye.initialX, this.rightEye.initialY, this.rightEye.initialZ);

		this.leftEye.currentEyeState = 0;
		this.rightEye.currentEyeState = 0;

		this.head.add(this.leftEye);
		this.head.add(this.rightEye);
	}

	update(faceData, delta) {
		if (faceData) {
			this._updateTargets(faceData);
		}

		this._applyAnimation(delta);
	}

	_updateTargets(face) {
		if (face.matrix?.data) {
			const m = face.matrix.data;
			this.headTargetPosition.set(
				Math.min(Math.max(-m[12], -15), 15) / 15,
				Math.min(Math.max(m[13], -12), 12) / 25,
				Math.min((m[14] + 45) / 15, 0.5)
			);

			const headTargetRotation = new THREE.Euler(
				-Math.atan2(m[9], m[10]) + 0.2,
				Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10])),
				Math.atan2(m[4], m[0])
			);
			this.headTargetQuaternion.setFromEuler(headTargetRotation);
		}

		if (face.landmarks) {
			const leftIris = face.landmarks[473];
			const rightIris = face.landmarks[468];

			// 468 = Right Iris, 473 = Left Iris
			// Range indices: Right Eye [33, 133], Left Eye [362, 263]

			const leftOffset = this._calculateEyeOffset(leftIris, face.landmarks[362], face.landmarks[263]);
			const rightOffset = this._calculateEyeOffset(rightIris, face.landmarks[133], face.landmarks[33]);

			this.leftEyeTargetPosition.set(
				this.leftEye.initialX + leftOffset.x,
				this.leftEye.initialY + leftOffset.y,
				this.leftEye.initialZ
			);

			this.rightEyeTargetPosition.set(
				this.rightEye.initialX + rightOffset.x,
				this.rightEye.initialY + rightOffset.y,
				this.rightEye.initialZ
			);
		}

		if (face.blendShapes?.categories) {
			const blinkLeft = face.blendShapes.categories[9]?.score || 0;
			const blinkRight = face.blendShapes.categories[10]?.score || 0;
			const smile = (face.blendShapes.categories[44]?.score + face.blendShapes.categories[45]?.score) / 2 || 0;

			const isBlinking = blinkLeft > this.blinkingFactor || blinkRight > this.blinkingFactor;
			const isSmiling = !isBlinking && smile > this.smilingFactor;

			const targetState = isSmiling ? 2 : (isBlinking ? 1 : 0);

			if (this.leftEye.currentEyeState !== targetState) {
				this.leftEye.currentEyeState = targetState;
				this.leftEye.material = this.eyeMaterials[targetState];
			}

			if (this.rightEye.currentEyeState !== targetState) {
				this.rightEye.currentEyeState = targetState;
				this.rightEye.material = this.eyeMaterials[targetState];
			}
		}
	}

	_calculateEyeOffset(iris, innerCorner, outerCorner) {
		const centerX = (innerCorner.x + outerCorner.x) / 2;
		const centerY = (innerCorner.y + outerCorner.y) / 2;

		const width = Math.abs(innerCorner.x - outerCorner.x);

		const virtualCenterY = centerY - (width / 4 + width / 8) / 2;

		const dx = centerX - iris.x;
		const dy = virtualCenterY - iris.y;

		return {
			x: Math.min(Math.max(dx * this.eyeMovementCoeff.x, -0.05), 0.05),
			y: Math.min(Math.max(dy * this.eyeMovementCoeff.y, -0.03), 0.03)
		};
	}

	_applyAnimation(delta) {
		if (!this.head) return;

		const eyeLerp = 1 - Math.pow(1 - this.eyeBaseCoeff, delta * 60);
		const headPosLerp = 1 - Math.pow(1 - this.headPositionBaseCoeff, delta * 60);
		const headQuatLerp = 1 - Math.pow(1 - this.headQuaternionBaseCoeff, delta * 60);

		this.leftEye.position.lerp(this.leftEyeTargetPosition, eyeLerp);
		this.rightEye.position.lerp(this.rightEyeTargetPosition, eyeLerp);

		this.head.position.lerp(this.headTargetPosition, headPosLerp);
		this.head.quaternion.slerp(this.headTargetQuaternion, headQuatLerp);
	}
}