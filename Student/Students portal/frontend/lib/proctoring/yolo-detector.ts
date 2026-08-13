import type { InferenceSession, Tensor } from "onnxruntime-web";

type OrtWasmRuntime = typeof import("onnxruntime-web/wasm");

type Box = { x1: number; y1: number; x2: number; y2: number; score: number; classId: number };
export type YoloDetectionResult = { personCount: number; phoneDetected: boolean; confidence: number };

const INPUT_SIZE = 320;
const PERSON_CLASS = 0;
const PHONE_CLASS = 67;

function overlap(a: Box, b: Box) {
  const area = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - area;
  return union > 0 ? area / union : 0;
}

function suppress(boxes: Box[]) {
  const output: Box[] = [];
  for (const candidate of boxes.sort((a, b) => b.score - a.score)) {
    if (!output.some((selected) => selected.classId === candidate.classId && overlap(selected, candidate) > 0.45)) output.push(candidate);
  }
  return output;
}

export class YoloCocoDetector {
  private runtime?: OrtWasmRuntime;
  private session?: InferenceSession;
  private canvas = document.createElement("canvas");
  private context: CanvasRenderingContext2D;

  constructor() {
    this.canvas.width = INPUT_SIZE;
    this.canvas.height = INPUT_SIZE;
    const context = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas inference is unavailable");
    this.context = context;
  }

  async load() {
    // Load only in the browser. The package's default entry enables JSEP and can
    // request `ort-wasm-simd-threaded.jsep.*`; the WASM entry uses the two local
    // runtime assets deployed under /public/models/onnx instead.
    const ort = await import("onnxruntime-web/wasm");
    this.runtime = ort;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = "/models/onnx/";
    this.session = await ort.InferenceSession.create("/models/yolov8n.onnx", {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  }

  async detect(video: HTMLVideoElement): Promise<YoloDetectionResult> {
    if (!this.runtime || !this.session || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return { personCount: 0, phoneDetected: false, confidence: 0 };
    this.context.drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = this.context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const input = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const plane = INPUT_SIZE * INPUT_SIZE;
    for (let index = 0; index < plane; index += 1) {
      input[index] = pixels[index * 4] / 255;
      input[plane + index] = pixels[index * 4 + 1] / 255;
      input[plane * 2 + index] = pixels[index * 4 + 2] / 255;
    }
    const feeds = { [this.session.inputNames[0]]: new this.runtime.Tensor("float32", input, [1, 3, INPUT_SIZE, INPUT_SIZE]) };
    const result = await this.session.run(feeds);
    const tensor = result[this.session.outputNames[0]] as Tensor;
    const data = tensor.data as Float32Array;
    const dimensions = tensor.dims.map(Number);
    const attributes = dimensions[1];
    const candidates = dimensions[2];
    if (attributes < 84 || candidates < 1) throw new Error(`Unsupported YOLO output ${dimensions.join("x")}`);
    const boxes: Box[] = [];
    for (let index = 0; index < candidates; index += 1) {
      let classId = -1;
      let score = 0;
      for (const target of [PERSON_CLASS, PHONE_CLASS]) {
        const confidence = data[(4 + target) * candidates + index];
        if (confidence > score) { score = confidence; classId = target; }
      }
      if (score < 0.48) continue;
      const x = data[index], y = data[candidates + index], width = data[candidates * 2 + index], height = data[candidates * 3 + index];
      boxes.push({ x1: x - width / 2, y1: y - height / 2, x2: x + width / 2, y2: y + height / 2, score, classId });
    }
    const selected = suppress(boxes);
    return {
      personCount: selected.filter((item) => item.classId === PERSON_CLASS).length,
      phoneDetected: selected.some((item) => item.classId === PHONE_CLASS),
      confidence: Math.max(0, ...selected.map((item) => item.score)),
    };
  }

  async close() {
    await this.session?.release();
    this.session = undefined;
    this.runtime = undefined;
  }
}
