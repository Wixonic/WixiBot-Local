import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

export class FaceTracker {
	constructor() {
		this.faceLandmarker = null;
		this.lastDetectTime = 0;
		this.detectionFps = 30;
	}

	async init() {
		try {
			const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");

			this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
					delegate: "CPU"
				},
				numFaces: 1,
				runningMode: "VIDEO",
				outputFaceBlendshapes: true,
				outputFacialTransformationMatrixes: true,
				minDetectionConfidence: 0.8,
				minTrackingConfidence: 0.8
			});
			console.log("FaceLandmarker initialized");
		} catch (e) {
			console.error("Models initialization failed:", e);
			throw e;
		}
	}

	async detect(videoElement, timestamp) {
		if (!this.faceLandmarker) return null;

		if (timestamp - this.lastDetectTime < 1000 / this.detectionFps) {
			return this.lastResult;
		}
		this.lastDetectTime = timestamp;

		try {
			const results = this.faceLandmarker.detectForVideo(videoElement, timestamp);
			if (results && results.faceLandmarks.length > 0) {
				this.lastResult = {
					landmarks: results.faceLandmarks[0],
					blendShapes: results.faceBlendshapes[0],
					matrix: results.facialTransformationMatrixes[0]
				};
				return this.lastResult;
			}
		} catch (e) {
			console.warn("Face landmarker error:", e);
			if (e.message.includes("Unset") || e.message.includes("call_indirect")) {
				console.error("Critical error in MediaPipe, suggesting re-init needed.");
				throw new Error("MEDIAPIPE_CRASH");
			}
		}

		return null;
	}
}
