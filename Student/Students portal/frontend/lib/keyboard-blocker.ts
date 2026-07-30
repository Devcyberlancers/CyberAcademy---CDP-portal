import type { AssessmentSecuritySettings } from "@/lib/assessment-security";

export function installKeyboardBlocker(settings: AssessmentSecuritySettings) {
  const blockedPlain = new Set(["F12"]);

  function isBlocked(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (blockedPlain.has(event.key)) return true;
    if ((event.ctrlKey || event.metaKey) && settings.disableCopy && key === "c") return true;
    if ((event.ctrlKey || event.metaKey) && settings.disablePaste && key === "v") return true;
    if ((event.ctrlKey || event.metaKey) && settings.disableCut && key === "x") return true;
    if ((event.ctrlKey || event.metaKey) && key === "a") return true;
    if ((event.ctrlKey || event.metaKey) && settings.disablePrinting && key === "p") return true;
    if ((event.ctrlKey || event.metaKey) && settings.disableSavePage && key === "s") return true;
    if ((event.ctrlKey || event.metaKey) && key === "u") return true;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && settings.disableInspectShortcuts && ["i", "j", "c"].includes(key)) return true;
    return false;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (isBlocked(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  document.addEventListener("keydown", onKeyDown, true);
  return () => document.removeEventListener("keydown", onKeyDown, true);
}
