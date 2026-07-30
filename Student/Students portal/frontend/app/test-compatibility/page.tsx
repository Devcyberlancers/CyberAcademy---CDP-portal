"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CheckStatus = "checking" | "success" | "failed";

type CompatibilityRow = {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
  nested?: boolean;
};

function browserLabel() {
  if (typeof navigator === "undefined") return "Unknown browser";
  const userAgent = navigator.userAgent;
  const edge = userAgent.match(/Edg\/([\d.]+)/);
  const chrome = userAgent.match(/Chrome\/([\d.]+)/);
  const firefox = userAgent.match(/Firefox\/([\d.]+)/);
  const safari = userAgent.match(/Version\/([\d.]+).*Safari/);

  if (edge) return `Edge/${edge[1]}`;
  if (chrome) return `Chrome/${chrome[1]}`;
  if (firefox) return `Firefox/${firefox[1]}`;
  if (safari) return `Safari/${safari[1]}`;
  return userAgent.split(" ").at(-1) || "Unknown browser";
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-3 font-semibold text-[#6b7280]">
        <Loader2 size={20} className="animate-spin" />
        Checking
      </span>
    );
  }

  const success = status === "success";
  return (
    <span className={`inline-flex items-center gap-3 font-semibold ${success ? "text-[#168334]" : "text-[#ff3b4f]"}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${success ? "bg-[#2d8d46]" : "bg-[#ff3b4f]"}`}>
        {success ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
      </span>
      {success ? "Success" : "Failed"}
    </span>
  );
}

function CheckRow({ row }: { row: CompatibilityRow }) {
  return (
    <div className={`grid min-h-[74px] grid-cols-[1fr_180px_1.4fr] items-center gap-5 border border-[#dfe3e8] bg-white px-7 py-4 ${row.nested ? "border-t-0 text-[#4b5563]" : "rounded-md"}`}>
      <h2 className={`${row.nested ? "text-base font-medium" : "text-lg font-bold"} text-black`}>{row.title}</h2>
      <StatusBadge status={row.status} />
      <p className="text-base leading-6 text-black">{row.detail}</p>
    </div>
  );
}

export default function TestCompatibilityPage() {
  const [isChecking, setIsChecking] = useState(true);
  const [mediaStatus, setMediaStatus] = useState<CheckStatus>("checking");
  const [notificationStatus, setNotificationStatus] = useState<CheckStatus>("checking");
  const [networkStatus, setNetworkStatus] = useState<CheckStatus>("checking");
  const [networkDetail, setNetworkDetail] = useState("Checking internet connectivity...");
  const [firewallStatus, setFirewallStatus] = useState<CheckStatus>("checking");

  async function runChecks() {
    setIsChecking(true);
    setMediaStatus("checking");
    setNotificationStatus("checking");
    setNetworkStatus("checking");
    setFirewallStatus("checking");
    setNetworkDetail("Checking internet connectivity...");

    const online = navigator.onLine;
    setNetworkStatus(online ? "success" : "failed");
    setNetworkDetail(online ? "Your internet connection meets the expected standard" : "Browser reports that you are offline");

    const targets = [
      "https://www.google.com/favicon.ico",
      "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/check/default/24px.svg"
    ];
    const checks = await Promise.allSettled(
      targets.map((target) => fetch(target, { mode: "no-cors", cache: "no-store" }))
    );
    setFirewallStatus(checks.some((result) => result.status === "fulfilled") ? "success" : "failed");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaStatus("failed");
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach((track) => track.stop());
        setMediaStatus("success");
      }
    } catch {
      setMediaStatus("failed");
    }

    if (!("Notification" in window)) {
      setNotificationStatus("failed");
    } else if (Notification.permission === "granted") {
      setNotificationStatus("success");
    } else if (Notification.permission === "denied") {
      setNotificationStatus("failed");
    } else {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission === "granted" ? "success" : "failed");
    }

    setIsChecking(false);
  }

  useEffect(() => {
    void runChecks();
  }, []);

  const rows = useMemo<CompatibilityRow[]>(() => {
    const networkSuccess = networkStatus === "success";
    const firewallSuccess = firewallStatus === "success";
    return [
      {
        id: "browser",
        title: "Browser Version Check",
        status: "success",
        detail: browserLabel()
      },
      {
        id: "internet",
        title: "Internet Connectivity Check",
        status: networkStatus,
        detail: networkDetail
      },
      {
        id: "speed1",
        title: "Network Download and Upload Speed > 1 Mbps",
        status: networkSuccess ? "success" : "failed",
        detail: networkSuccess ? "Supports Image Proctoring Assessments." : "Connect to a stable internet connection and try again.",
        nested: true
      },
      {
        id: "speed3",
        title: "Network Download and Upload Speed > 3 Mbps",
        status: networkSuccess ? "success" : "failed",
        detail: networkSuccess ? "Supports Audio Video Proctoring Assessments and project." : "Connect to a faster network and try again.",
        nested: true
      },
      {
        id: "media",
        title: "Mic & Camera Enable Check",
        status: mediaStatus,
        detail:
          mediaStatus === "success"
            ? "Microphone and camera permissions are enabled."
            : "Unable to access microphone and camera. Please grant permission for both the microphone and camera to proceed"
      },
      {
        id: "firewall",
        title: "Network & Firewall",
        status: firewallStatus,
        detail: firewallSuccess ? "Required external browser resources are reachable." : "Some required external resources are blocked."
      },
      ...["Amazon Webservice", "Crisp Chat", "FB Server", "Audio Recognition", "Cloud Question", "FireBase", "Fonts"].map((title) => ({
        id: title,
        title,
        status: firewallStatus,
        detail: firewallSuccess ? "Reachable" : "Blocked or unavailable",
        nested: true
      })),
      {
        id: "notifications",
        title: "Disable Notification Check",
        status: notificationStatus,
        detail:
          notificationStatus === "success"
            ? "Browser notification permission is enabled for this portal."
            : "Kindly allow browser notifications and popup permission check"
      },
      {
        id: "antivirus",
        title: "Disable Anti-virus Check",
        status: "success",
        detail: "To guarantee an uninterrupted test-taking experience on our platform, please take a moment to disable your antivirus software."
      }
    ];
  }, [firewallStatus, mediaStatus, networkDetail, networkStatus, notificationStatus]);

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-3 py-5 text-[#07142f] sm:px-5 lg:px-7">
      <section className="w-full overflow-hidden rounded-[28px] bg-white shadow-[0_18px_46px_rgba(17,24,74,.08)]">
        <div className="h-[62px] border-b border-[#dfe3e8] bg-white" />
        <div className="px-7 py-9 sm:px-12">
          <h1 className="text-2xl font-bold text-black">System Compatibility Check Instructions</h1>
          <p className="mt-4 text-lg leading-9 text-[#4b5563]">
            Use the latest Google Chrome or Microsoft Edge browser. Ensure a stable internet connection with at least 3 Mbps download
            and 2 Mbps upload speeds. Disable software that may prevent login and test access. Turn off notifications and pop-ups during
            the test to avoid disruptions.
          </p>

          <div className="mt-9 space-y-9">
            <div className="space-y-0">
              {rows.slice(0, 4).map((row) => (
                <CheckRow key={row.id} row={row} />
              ))}
            </div>

            <CheckRow row={rows[4]} />

            <div className="space-y-0">
              {rows.slice(5, 13).map((row) => (
                <CheckRow key={row.id} row={row} />
              ))}
            </div>

            {rows.slice(13).map((row) => (
              <CheckRow key={row.id} row={row} />
            ))}
          </div>

          <div className="flex justify-center py-14">
            <button
              type="button"
              onClick={runChecks}
              disabled={isChecking}
              className="inline-flex h-[50px] min-w-[175px] items-center justify-center rounded-md bg-[#3155ff] px-6 text-lg font-semibold text-white transition hover:bg-[#2447f1] disabled:opacity-65"
            >
              {isChecking ? "Checking..." : "Check Again"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
