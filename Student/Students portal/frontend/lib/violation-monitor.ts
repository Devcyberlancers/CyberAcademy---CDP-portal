import type { AssessmentSecuritySettings } from "@/lib/assessment-security";

type ViolationHandler = (reason: string, eventType: string) => void;

export function installViolationMonitor(settings: AssessmentSecuritySettings, onViolation: ViolationHandler, onEvent?: ViolationHandler, graceMs = 2500) {
  let armed = true;
  const ignoreUntil = Date.now() + graceMs;

  function trigger(reason: string, eventType: string) {
    if (!armed) return;
    onEvent?.(reason, eventType);
    if (Date.now() < ignoreUntil) return;
    if (!settings.enabled) return;
    onViolation(reason, eventType);
  }

  function onVisibilityChange() {
    if (document.visibilityState !== "visible" && settings.endOnTabSwitch) {
      trigger("TAB_SWITCH", "visibilitychange");
    }
  }

  function onBlur() {
    if (settings.endOnBlur) trigger("WINDOW_BLUR", "blur");
  }

  function onFocus() {
    onEvent?.("WINDOW_FOCUS", "focus");
  }

  function onFullscreenChange() {
    if (!document.fullscreenElement && settings.endOnFullscreenExit) {
      trigger("FULLSCREEN_EXIT", "fullscreenchange");
    }
  }

  function onPageHide() {
    trigger("PAGE_HIDE", "pagehide");
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    trigger("BROWSER_CLOSED", "beforeunload");
    event.preventDefault();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    armed = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}
