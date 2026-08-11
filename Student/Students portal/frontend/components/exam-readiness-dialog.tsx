"use client";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { enterFullscreen } from "@/lib/fullscreen-manager";
type Props = {
  title: string;
  onClose: () => void;
  onProceed: () => void | Promise<void>;
};
function environment() {
  const a = navigator.userAgent,
    m =
      a.match(/(?:Edg|OPR|Firefox|Chrome)\/(\d+)/i) ||
      a.match(/Version\/(\d+).*Safari/i);
  const name = /Edg\//i.test(a)
    ? "Edge"
    : /OPR\//i.test(a)
      ? "Opera"
      : /Firefox\//i.test(a)
        ? "Firefox"
        : /Chrome\//i.test(a)
          ? "Chrome"
          : /Safari\//i.test(a)
            ? "Safari"
            : "Unsupported";
  const version = Number(m?.[1] || 0),
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    browser: `${name} ${version}`,
    supported:
      name !== "Unsupported" && version >= (name === "Safari" ? 12 : 60),
    desktop: !/Android|iPhone|iPad|iPod|Mobile/i.test(a) && innerWidth >= 768,
    ist:
      new Date().getTimezoneOffset() === -330 ||
      ["Asia/Calcutta", "Asia/Kolkata"].includes(zone),
  };
}
export function ExamReadinessDialog({ title, onClose, onProceed }: Props) {
  const [media, setMedia] = useState<"idle" | "checking" | "ok" | "failed">(
      "idle",
    ),
    [error, setError] = useState("");
  const e = environment();
  const checks = [
    ["Supported browser", e.browser, e.supported],
    [
      "Secure HTTPS connection",
      "Required for protected browser features",
      window.isSecureContext ||
        ["localhost", "127.0.0.1"].includes(location.hostname),
    ],
    [
      "Internet connection",
      navigator.onLine ? "Online" : "Offline",
      navigator.onLine,
    ],
    ["Laptop or desktop", "Mobile devices are not supported", e.desktop],
    [
      "Fullscreen exam mode",
      "Required throughout the test",
      Boolean(document.fullscreenEnabled),
    ],
    ["Cookies", "Required for the exam session", navigator.cookieEnabled],
    ["IST timezone", "GMT +05:30 required", e.ist],
    [
      "Tab and focus monitoring",
      "Tab exits and window changes will be recorded",
      typeof document.hidden === "boolean",
    ],
    [
      "Camera and microphone",
      media === "ok"
        ? "Permission verified"
        : media === "failed"
          ? "Permission denied"
          : "Run the media check",
      media === "ok",
    ],
  ] as const;
  const ready = checks.every((x) => x[2]);
  async function verify() {
    setMedia("checking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      s.getTracks().forEach((t) => t.stop());
      setMedia("ok");
    } catch {
      setMedia("failed");
    }
  }
  async function start() {
    if (!ready) return;
    try {
      await enterFullscreen();
      await onProceed();
      onClose();
    } catch {
      setError("Allow fullscreen access and try again.");
    }
  }
  return (
    <section
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex justify-between border-b p-5">
          <div>
            <p className="text-sm font-semibold text-[#3155ff]">
              System readiness check
            </p>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-slate-600">
              All checks must pass before the timer starts.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <div className="overflow-y-auto p-5">
          <div className="divide-y rounded-lg border">
            {checks.map(([label, detail, ok]) => (
              <div key={label} className="flex gap-3 px-4 py-3">
                <span
                  className={`grid h-5 w-5 place-items-center rounded border ${ok ? "bg-emerald-600 text-white" : ""}`}
                >
                  {ok && <Check size={14} />}
                </span>
                <div>
                  <b>{label}</b>
                  <p className="text-sm text-slate-600">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Browsers cannot list or close other tabs. The exam blocks clipboard
            actions and shortcuts, detects leaving the exam, and applies the
            configured violation policy.
          </p>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
        <footer className="flex justify-end gap-3 border-t p-4">
          <button
            onClick={() => void verify()}
            disabled={media === "checking"}
            className="rounded border border-[#3155ff] px-4 py-2.5 text-[#3155ff]"
          >
            {media === "checking" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              "Check camera and microphone"
            )}
          </button>
          <button
            disabled={!ready}
            onClick={() => void start()}
            className="rounded bg-[#153998] px-5 py-2.5 font-bold text-white disabled:bg-slate-400"
          >
            Agree &amp; Start Test
          </button>
        </footer>
      </div>
    </section>
  );
}
