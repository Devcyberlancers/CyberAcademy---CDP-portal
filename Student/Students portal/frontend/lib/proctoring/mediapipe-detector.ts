import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

export type FaceDetectionResult = { count: number; confidence: number };

export class MediaPipeFaceDetector {
  private detector?: FaceDetector;

  async load() {
    const vision = await FilesetResolver.forVisionTasks("/models/mediapipe");
    this.detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.55,
    });
  }

  detect(video: HTMLVideoElement, timestamp: number): FaceDetectionResult {
    if (!this.detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return { count: 0, confidence: 0 };
    const detections = this.detector.detectForVideo(video, timestamp).detections;
    return {
      count: detections.length,
      confidence: Math.max(0, ...detections.map((item) => item.categories[0]?.score ?? 0)),
    };
  }

  close() {
    this.detector?.close();
    this.detector = undefined;
  }
}
