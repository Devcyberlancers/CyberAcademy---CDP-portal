import { AudioActivityMonitor } from "./audio-monitor";
import { MediaPipeFaceDetector } from "./mediapipe-detector";
import { activeTrack, proctoringStreams, stopProctoringStreams } from "./media-streams";
import type {
  ProctoringAction, ProctoringConfig, ProctoringEvent, ProctoringEventType,
  ProctoringSessionHandlers, ProctoringState,
} from "./types";
import { defaultProctoringConfig } from "./types";
import { YoloCocoDetector } from "./yolo-detector";

const initialState = (): ProctoringState => ({
  status: "PROCTORING_INITIALIZING", camera: false, microphone: false, screenShare: false,
  fullscreen: false, faceDetected: null, personCount: null, phoneDetected: null, audioLevel: 0,
  phoneWarningCount: 0, phoneWarningDeadline: null,
  detectorHealth: { mediapipe: "initializing", yolo: "initializing", browser: "initializing", audio: "initializing" },
});

export class ProctoringEngine {
  private state = initialState();
  private face = new MediaPipeFaceDetector();
  private yolo?: YoloCocoDetector;
  private audio = new AudioActivityMonitor();
  private video = document.createElement("video");
  private handlers: ProctoringSessionHandlers = {};
  private listeners = new Set<(state: ProctoringState) => void>();
  private cleanup: Array<() => void> = [];
  private timers: number[] = [];
  private queue: ProctoringEvent[] = [];
  private recent = new Map<string, number>();
  private active = false;
  private stopped = false;
  private yoloBusy = false;
  private phonePresent = false;
  private phoneLastSeen = 0;

  constructor(private config: ProctoringConfig) {
    this.video.muted = true;
    this.video.playsInline = true;
  }

  getState() { return { ...this.state, detectorHealth: { ...this.state.detectorHealth } }; }

  subscribe(listener: (state: ProctoringState) => void) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  configureSession(handlers: ProctoringSessionHandlers) {
    this.handlers = handlers;
    handlers.onStateChange?.(this.getState());
  }

  private update(patch: Partial<ProctoringState>) {
    this.state = { ...this.state, ...patch, detectorHealth: patch.detectorHealth ?? this.state.detectorHealth };
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
    this.handlers.onStateChange?.(snapshot);
  }

  async initialize() {
    this.update({ status: "PROCTORING_INITIALIZING", error: undefined });
    const streams = proctoringStreams();
    if (this.config.camera && !activeTrack(streams.camera, "video")) throw await this.fail("A live camera stream is required.");
    if (this.config.microphone && !activeTrack(streams.camera, "audio")) throw await this.fail("A live microphone stream is required.");
    if (this.config.screenShare && !activeTrack(streams.screen, "video")) throw await this.fail("A live screen-share stream is required.");
    if (streams.camera && activeTrack(streams.camera, "video")) {
      this.video.srcObject = streams.camera;
      await this.video.play();
    }
    const health = { ...this.state.detectorHealth, browser: "healthy" as const };
    try {
      if (this.config.faceDetection) { await this.face.load(); health.mediapipe = "healthy"; }
      else health.mediapipe = "disabled";
    } catch (error) {
      health.mediapipe = "error";
      throw await this.fail("MediaPipe face detection could not be initialized.", error, health);
    }
    try {
      if (this.config.personDetection || this.config.phoneDetection) {
        this.yolo = new YoloCocoDetector();
        await this.yolo.load();
        health.yolo = "healthy";
      } else health.yolo = "disabled";
    } catch (error) {
      health.yolo = "error";
      throw await this.fail("YOLO COCO detection could not be initialized.", error, health);
    }
    try {
      if (this.config.audioMonitoring && streams.camera) {
        this.audio.start(streams.camera, (level, sustained) => {
          this.update({ audioLevel: level });
          if (sustained && this.active) this.emit("AUDIO_ACTIVITY", "warning", Math.min(1, level / 100), { level });
        });
        health.audio = "healthy";
      } else health.audio = "disabled";
    } catch {
      // Audio analysis is recoverable and must not disable visual/browser monitoring.
      health.audio = "error";
    }
    this.update({
      status: "PROCTORING_READY", camera: activeTrack(streams.camera, "video"),
      microphone: activeTrack(streams.camera, "audio"), screenShare: activeTrack(streams.screen, "video"),
      fullscreen: Boolean(document.fullscreenElement), detectorHealth: health,
    });
    return this.getState();
  }

  async start() {
    if (this.state.status !== "PROCTORING_READY") throw new Error("Proctoring must be ready before the assessment starts.");
    this.active = true;
    this.stopped = false;
    this.update({ status: "PROCTORING_ACTIVE", fullscreen: Boolean(document.fullscreenElement) });
    this.installBrowserMonitoring();
    this.installTrackMonitoring();
    if (this.config.faceDetection) this.timers.push(window.setInterval(() => this.detectFace(), 900));
    if ((this.config.personDetection || this.config.phoneDetection) && this.yolo) this.timers.push(window.setInterval(() => void this.detectObjects(), 1500));
    this.timers.push(window.setInterval(() => void this.flush(), 5000));
  }

  private installBrowserMonitoring() {
    const visibility = () => { if (this.active && document.hidden && this.config.tabSwitchMonitoring) this.emit("TAB_SWITCH", "critical", 1, { visibilityState: document.visibilityState }); };
    const blur = () => { if (this.active && this.config.windowBlurMonitoring) this.emit("WINDOW_BLUR", "critical", 1); };
    const fullscreen = () => {
      this.update({ fullscreen: Boolean(document.fullscreenElement) });
      if (this.active && this.config.fullscreen && !document.fullscreenElement) this.emit("FULLSCREEN_EXIT", "critical", 1);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    document.addEventListener("fullscreenchange", fullscreen);
    this.cleanup.push(() => document.removeEventListener("visibilitychange", visibility));
    this.cleanup.push(() => window.removeEventListener("blur", blur));
    this.cleanup.push(() => document.removeEventListener("fullscreenchange", fullscreen));
  }

  private installTrackMonitoring() {
    const streams = proctoringStreams();
    const watch = (track: MediaStreamTrack | undefined, type: ProctoringEventType, patch: Partial<ProctoringState>) => {
      if (!track) return;
      const ended = () => { this.update(patch); if (this.active) this.emit(type, "critical", 1); };
      track.addEventListener("ended", ended);
      this.cleanup.push(() => track.removeEventListener("ended", ended));
    };
    watch(streams.camera?.getVideoTracks()[0], "CAMERA_STOPPED", { camera: false });
    watch(streams.camera?.getAudioTracks()[0], "MICROPHONE_STOPPED", { microphone: false });
    watch(streams.screen?.getVideoTracks()[0], "SCREEN_SHARE_STOPPED", { screenShare: false });
  }

  private detectFace() {
    try {
      const result = this.face.detect(this.video, performance.now());
      this.update({ faceDetected: result.count === 1 });
      if (result.count === 0) this.emit("FACE_NOT_DETECTED", "warning", 1 - result.confidence);
      else if (result.count > 1) this.emit("MULTIPLE_FACES", "critical", result.confidence, { count: result.count });
      else this.emit("FACE_DETECTED", "info", result.confidence);
    } catch { this.update({ detectorHealth: { ...this.state.detectorHealth, mediapipe: "error" } }); }
  }

  private async detectObjects() {
    if (this.yoloBusy) return;
    this.yoloBusy = true;
    try {
      const result = await this.yolo?.detect(this.video);
      if (!result) return;
      this.update({ personCount: result.personCount });
      if (this.config.personDetection) {
        if (result.personCount === 0) this.emit("NO_PERSON_DETECTED", "warning", result.confidence);
        else if (result.personCount > 1) this.emit("MULTIPLE_PERSONS", "critical", result.confidence, { count: result.personCount });
        else this.emit("PERSON_DETECTED", "info", result.confidence);
      }
      if (this.config.phoneDetection) this.trackPhone(result.phoneDetected, result.confidence);
    } catch { this.update({ detectorHealth: { ...this.state.detectorHealth, yolo: "error" } }); }
    finally { this.yoloBusy = false; }
  }

  private trackPhone(detected: boolean, confidence: number) {
    const now = Date.now();
    if (detected) {
      this.phoneLastSeen = now;
      if (!this.phonePresent) {
        this.phonePresent = true;
        this.issuePhoneWarning(confidence);
      } else if (this.state.phoneWarningDeadline && now >= this.state.phoneWarningDeadline) {
        this.issuePhoneWarning(confidence);
      }
      return;
    }
    if (this.phonePresent && now - this.phoneLastSeen < 3000) return;
    this.phonePresent = false;
    this.update({
      phoneDetected: false,
      phoneWarningDeadline: null,
      status: this.active ? "PROCTORING_ACTIVE" : this.state.status,
    });
  }

  private issuePhoneWarning(confidence: number) {
    const warningNumber = this.state.phoneWarningCount + 1;
    const autoSubmit = warningNumber >= 4;
    this.update({
      phoneDetected: true,
      phoneWarningCount: warningNumber,
      phoneWarningDeadline: autoSubmit ? null : Date.now() + 10_000,
      status: "PROCTORING_WARNING",
    });
    this.emit("PHONE_DETECTED", autoSubmit ? "critical" : "warning", confidence, {
      warningNumber,
      warningsAllowed: 3,
      graceSeconds: autoSubmit ? 0 : 10,
      autoSubmit,
      force: true,
    });
  }

  private action(event: ProctoringEvent): ProctoringAction {
    if (event.severity === "info") return "LOG_ONLY";
    if (event.type === "PHONE_DETECTED") return event.metadata?.autoSubmit === true ? "AUTO_SUBMIT" : "WARN";
    if (event.severity === "warning") return "WARN";
    if (event.type === "TAB_SWITCH" && !this.config.endOnTabSwitch) return "WARN";
    if (event.type === "WINDOW_BLUR" && !this.config.endOnBlur) return "WARN";
    if (event.type === "FULLSCREEN_EXIT" && !this.config.endOnFullscreenExit) return "WARN";
    if (this.config.violationPolicy === "warning") return "WARN";
    if (this.config.violationPolicy === "auto_submit") return "AUTO_SUBMIT";
    return "TERMINATE";
  }

  private emit(type: ProctoringEventType, severity: ProctoringEvent["severity"], confidence?: number, metadata?: Record<string, unknown>) {
    const now = Date.now();
    const dedupe = !["TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT", "SCREEN_SHARE_STOPPED", "CAMERA_STOPPED", "MICROPHONE_STOPPED"].includes(type);
    if (dedupe && metadata?.force !== true && now - (this.recent.get(type) ?? 0) < 8000) return;
    this.recent.set(type, now);
    const event = { type, timestamp: now, severity, confidence, metadata } satisfies ProctoringEvent;
    this.queue.push(event);
    if (severity !== "info") this.update({ status: "PROCTORING_WARNING" });
    else if (this.active && this.state.status === "PROCTORING_WARNING") this.update({ status: "PROCTORING_ACTIVE" });
    const action = this.action(event);
    if (action !== "LOG_ONLY") void this.handlers.onPolicyAction?.(action, event);
  }

  async flush() {
    if (!this.queue.length) return;
    const events = this.queue.splice(0);
    try { await this.handlers.onEvents?.(events); }
    catch { this.queue.unshift(...events); }
  }

  private async fail(message: string, cause?: unknown, health = this.state.detectorHealth) {
    const error = cause instanceof Error ? `${message} ${cause.message}` : message;
    this.update({ status: "PROCTORING_ERROR", error, detectorHealth: health });
    this.queue.push({ type: "PROCTORING_INITIALIZATION_FAILED", timestamp: Date.now(), severity: "critical", metadata: { message: error } });
    return new Error(error);
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.active = false;
    this.timers.forEach((timer) => window.clearInterval(timer));
    this.timers = [];
    this.cleanup.splice(0).forEach((remove) => remove());
    await this.flush();
    await Promise.allSettled([this.audio.stop(), this.yolo?.close() ?? Promise.resolve()]);
    this.face.close();
    this.video.pause();
    this.video.srcObject = null;
    stopProctoringStreams();
    this.update({ status: "PROCTORING_STOPPED", camera: false, microphone: false, screenShare: false, phoneDetected: false, phoneWarningDeadline: null, audioLevel: 0 });
  }
}

let preparedEngine: ProctoringEngine | null = null;

export async function prepareProctoring(config: Partial<ProctoringConfig> = {}) {
  await preparedEngine?.stop();
  preparedEngine = new ProctoringEngine({ ...defaultProctoringConfig, ...config });
  await preparedEngine.initialize();
  return preparedEngine;
}

export function getPreparedProctoringEngine() { return preparedEngine; }

export async function stopPreparedProctoring() {
  const engine = preparedEngine;
  preparedEngine = null;
  await engine?.stop();
}

export function configFromAssessmentSecurity(security?: Partial<{
  enabled: boolean; requireFullscreen: boolean; endOnFullscreenExit: boolean;
  cameraEnabled: boolean;
  endOnTabSwitch: boolean; endOnBlur: boolean; violationPolicy: "warning" | "auto_submit" | "end_exam";
}>): ProctoringConfig {
  return {
    ...defaultProctoringConfig,
    camera: security?.cameraEnabled ?? true,
    faceDetection: security?.cameraEnabled ?? true,
    personDetection: security?.cameraEnabled ?? true,
    phoneDetection: security?.cameraEnabled ?? true,
    fullscreen: security?.requireFullscreen ?? true,
    tabSwitchMonitoring: security?.enabled ?? true,
    windowBlurMonitoring: security?.enabled ?? true,
    endOnFullscreenExit: security?.endOnFullscreenExit ?? true,
    endOnTabSwitch: security?.endOnTabSwitch ?? true,
    endOnBlur: security?.endOnBlur ?? true,
    violationPolicy: security?.violationPolicy ?? "end_exam",
  };
}
