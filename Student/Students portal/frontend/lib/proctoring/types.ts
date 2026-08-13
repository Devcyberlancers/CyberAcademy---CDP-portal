export type ProctoringEventType =
  | "FACE_DETECTED" | "FACE_NOT_DETECTED" | "MULTIPLE_FACES"
  | "PERSON_DETECTED" | "NO_PERSON_DETECTED" | "MULTIPLE_PERSONS" | "PHONE_DETECTED"
  | "TAB_SWITCH" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "SCREEN_SHARE_STOPPED"
  | "CAMERA_STOPPED" | "MICROPHONE_STOPPED" | "AUDIO_ACTIVITY"
  | "PROCTORING_INITIALIZATION_FAILED";

export type ProctoringSeverity = "info" | "warning" | "critical";
export type ProctoringStatus =
  | "PROCTORING_INITIALIZING" | "PROCTORING_READY" | "PROCTORING_ACTIVE"
  | "PROCTORING_WARNING" | "PROCTORING_ERROR" | "PROCTORING_STOPPED";
export type DetectorHealth = "healthy" | "error" | "disabled" | "initializing";
export type ProctoringAction = "LOG_ONLY" | "WARN" | "AUTO_SUBMIT" | "TERMINATE";

export type ProctoringEvent = {
  type: ProctoringEventType;
  timestamp: number;
  severity: ProctoringSeverity;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export type ProctoringConfig = {
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
  fullscreen: boolean;
  faceDetection: boolean;
  personDetection: boolean;
  phoneDetection: boolean;
  audioMonitoring: boolean;
  tabSwitchMonitoring: boolean;
  windowBlurMonitoring: boolean;
  endOnTabSwitch: boolean;
  endOnBlur: boolean;
  endOnFullscreenExit: boolean;
  violationPolicy: "warning" | "auto_submit" | "end_exam";
};

export type ProctoringState = {
  status: ProctoringStatus;
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
  fullscreen: boolean;
  faceDetected: boolean | null;
  personCount: number | null;
  phoneDetected: boolean | null;
  audioLevel: number;
  detectorHealth: {
    mediapipe: DetectorHealth;
    yolo: DetectorHealth;
    browser: DetectorHealth;
    audio: DetectorHealth;
  };
  error?: string;
};

export type ProctoringSessionHandlers = {
  onEvents?: (events: ProctoringEvent[]) => void | Promise<void>;
  onPolicyAction?: (action: ProctoringAction, event: ProctoringEvent) => void | Promise<void>;
  onStateChange?: (state: ProctoringState) => void;
};

export const defaultProctoringConfig: ProctoringConfig = {
  camera: true, microphone: true, screenShare: true, fullscreen: true,
  faceDetection: true, personDetection: true, phoneDetection: true,
  audioMonitoring: true, tabSwitchMonitoring: true, windowBlurMonitoring: true,
  endOnTabSwitch: true, endOnBlur: true, endOnFullscreenExit: true,
  violationPolicy: "end_exam",
};
