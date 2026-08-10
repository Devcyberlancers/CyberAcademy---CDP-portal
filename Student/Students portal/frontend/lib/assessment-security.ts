export type ViolationPolicy = "warning" | "auto_submit" | "end_exam";

export type AssessmentSecuritySettings = {
  enabled: boolean;
  requireFullscreen: boolean;
  endOnFullscreenExit: boolean;
  endOnTabSwitch: boolean;
  endOnBlur: boolean;
  disableRightClick: boolean;
  disableCopy: boolean;
  disablePaste: boolean;
  disableCut: boolean;
  disableDrag: boolean;
  disableTextSelection: boolean;
  disablePrinting: boolean;
  disableSavePage: boolean;
  disableInspectShortcuts: boolean;
  randomizeQuestionOrder: boolean;
  randomizeOptionOrder: boolean;
  autoSaveAnswers: boolean;
  autoSubmitOnTimerEnd: boolean;
  logDeviceInfo: boolean;
  logBrowserInfo: boolean;
  logIpAddress: boolean;
  logSessionChanges: boolean;
  violationPolicy: ViolationPolicy;
};

export type SecureAssessmentSummary = {
  assignmentId: string;
  title: string;
  durationMinutes: number;
  safeMode: boolean;
  resumeAllowed: boolean;
  maxAttempts: number;
  attemptsUsed: number;
  remainingAttempts: number;
  latestAttemptStatus: "in_progress" | "completed" | "terminated" | "auto_submitted" | null;
  latestAttemptId: number | null;
  canStart: boolean;
  questionCount: number;
  attempts: AssessmentAttemptSummary[];
  security: AssessmentSecuritySettings;
};


export type AssessmentAttemptSummary = {
  attemptId: number;
  attemptNumber: number;
  status: "in_progress" | "completed" | "terminated" | "auto_submitted";
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  score: number;
  violations: number;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
};
export type SecureQuestion = {
  id: string;
  text: string;
  options: Array<{ id: string; text: string }>;
};

export type SecureAttempt = {
  action?: "start" | "resume";
  attemptId: number;
  attemptNumber: number;
  assignmentId: string;
  title: string;
  durationMinutes: number;
  maxAttempts: number;
  resumeAllowed: boolean;
  status: "in_progress" | "completed" | "terminated" | "auto_submitted";
  startedAt: string;
  endedAt: string | null;
  terminationReason: string | null;
  autoSubmitted: boolean;
  violations: number;
  score: number;
  answers: Record<string, string>;
  questions: SecureQuestion[];
  security: AssessmentSecuritySettings;
  endsAt: string;
  remainingSeconds: number;
};

export function detectDevice() {
  const userAgent = navigator.userAgent;
  const browser = userAgent.includes("Edg") ? "Microsoft Edge" : userAgent.includes("Chrome") ? "Chrome" : userAgent.includes("Firefox") ? "Firefox" : "Browser";
  const operating_system = navigator.platform || "Unknown OS";
  return {
    browser,
    operating_system,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    user_agent: userAgent
  };
}

export function violationText(reason: string | null) {
  const labels: Record<string, string> = {
    TAB_SWITCH: "Tab switch detected.",
    WINDOW_BLUR: "Browser window lost focus.",
    FULLSCREEN_EXIT: "Fullscreen was exited.",
    PAGE_HIDE: "Assessment page was hidden.",
    BROWSER_CLOSED: "Browser close or navigation was detected.",
    TIMER_EXPIRED: "Timer expired."
  };
  return labels[reason || ""] || "A prohibited action was detected.";
}
