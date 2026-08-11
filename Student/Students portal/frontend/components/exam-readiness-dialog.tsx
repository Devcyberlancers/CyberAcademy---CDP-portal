"use client";

import { Check, Loader2, MonitorUp, X } from "lucide-react";
import { useState } from "react";
import { enterFullscreen } from "@/lib/fullscreen-manager";

type Props = { title: string; onClose: () => void; onProceed: () => void | Promise<void> };
type CheckState = "idle" | "checking" | "ok" | "failed";
type ScreenWindow = Window & { __cyberAcademyScreenStream?: MediaStream };

function environment() {
  const agent=navigator.userAgent;
  const match=agent.match(/(?:Edg|OPR|Firefox|Chrome)\/(\d+)/i)||agent.match(/Version\/(\d+).*Safari/i);
  const name=/Edg\//i.test(agent)?"Edge":/OPR\//i.test(agent)?"Opera":/Firefox\//i.test(agent)?"Firefox":/Chrome\//i.test(agent)?"Chrome":/Safari\//i.test(agent)?"Safari":"Unsupported";
  const version=Number(match?.[1]||0),zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {browser:`${name} ${version}`,supported:name!=="Unsupported"&&version>=(name==="Safari"?12:60),desktop:!/Android|iPhone|iPad|iPod|Mobile/i.test(agent)&&innerWidth>=768,ist:new Date().getTimezoneOffset()===-330||["Asia/Calcutta","Asia/Kolkata"].includes(zone)};
}

export function ExamReadinessDialog({title,onClose,onProceed}:Props){
 const [media,setMedia]=useState<CheckState>("idle"),[screen,setScreen]=useState<CheckState>("idle"),[error,setError]=useState(""),[countdown,setCountdown]=useState<number|null>(null);
 const env=environment();
 const secure=window.isSecureContext||["localhost","127.0.0.1"].includes(location.hostname);
 const checks=[
  ["Supported browser",env.browser,env.supported],
  ["Secure HTTPS connection","Required for protected browser features",secure],
  ["Internet connection",navigator.onLine?"Online":"Offline",navigator.onLine],
  ["Laptop or desktop","Mobile devices are not supported",env.desktop],
  ["Fullscreen exam mode","Required throughout the test",Boolean(document.fullscreenEnabled)],
  ["Cookies","Required for the exam session",navigator.cookieEnabled],
  ["IST timezone","GMT +05:30 required",env.ist],
  ["Tab and focus monitoring","Tab exits and window changes will be recorded",typeof document.hidden==="boolean"],
  ["Camera and microphone",media==="ok"?"Permission verified":media==="failed"?"Permission denied":"Run the camera check",media==="ok"],
  ["Screen sharing",screen==="ok"?"Screen sharing is active":screen==="failed"?"Screen sharing was denied or stopped":"Share your screen before starting",screen==="ok"],
 ] as const;
 const ready=checks.every((item)=>item[2]);
 function stopShare(){const stream=(window as ScreenWindow).__cyberAcademyScreenStream;stream?.getTracks().forEach((track)=>track.stop());delete (window as ScreenWindow).__cyberAcademyScreenStream}
 function close(){stopShare();onClose()}
 async function verifyMedia(){setMedia("checking");setError("");try{const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});stream.getTracks().forEach((track)=>track.stop());setMedia("ok")}catch{setMedia("failed");setError("Allow camera and microphone access, then run the check again.")}}
 async function shareScreen(){
  setScreen("checking");setError("");
  try{
   stopShare();
   const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
   const track=stream.getVideoTracks()[0];
   if(!track)throw new Error("No screen selected");
   (window as ScreenWindow).__cyberAcademyScreenStream=stream;
   track.addEventListener("ended",()=>setScreen("failed"),{once:true});
   setScreen("ok");
  }catch{setScreen("failed");setError("Select a screen or window in the browser sharing prompt, then try again.")}}
 async function start(){
  if(!ready)return;
  setError("");
  try{
   await enterFullscreen();
   for(let value=3;value>0;value-=1){setCountdown(value);await new Promise((resolve)=>window.setTimeout(resolve,1000))}
   setCountdown(0);await onProceed();onClose();
  }catch{setCountdown(null);setError("Allow fullscreen access and keep screen sharing active, then try again.")}}
 if(countdown!==null)return <section className="fixed inset-0 z-[120] grid place-items-center bg-[#07142f] text-white" role="status"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[.24em] text-blue-200">Secure test starting</p><div className="mx-auto mt-6 grid h-36 w-36 place-items-center rounded-full border-4 border-white/20 text-7xl font-bold shadow-[0_0_0_10px_rgba(49,85,255,.25)]">{countdown||"GO"}</div><p className="mt-6 text-lg">Stay in fullscreen and keep screen sharing active.</p></div></section>;
 return <section className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
  <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
   <header className="flex justify-between border-b p-5"><div><p className="text-sm font-semibold text-[#3155ff]">System readiness check</p><h2 className="text-xl font-bold">{title}</h2><p className="text-sm text-slate-600">All checks must pass before the countdown starts.</p></div><button onClick={close} aria-label="Close"><X/></button></header>
   <div className="overflow-y-auto p-5"><div className="divide-y rounded-lg border">{checks.map(([label,detail,ok])=><div key={label} className="flex gap-3 px-4 py-3"><span className={`grid h-5 w-5 place-items-center rounded border ${ok?"border-emerald-600 bg-emerald-600 text-white":"border-slate-400"}`}>{ok?<Check size={14}/>:null}</span><div><b>{label}</b><p className="text-sm text-slate-600">{detail}</p></div></div>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Web browsers cannot inspect or close other open tabs. During the test, leaving this tab is detected, clipboard actions are blocked, fullscreen is enforced, and the active screen-share ending is recorded.</p>{error?<p className="mt-3 text-sm font-semibold text-red-700">{error}</p>:null}</div>
   <footer className="flex flex-wrap justify-end gap-3 border-t p-4"><button onClick={()=>void verifyMedia()} disabled={media==="checking"} className="rounded border border-[#3155ff] px-4 py-2.5 text-[#3155ff]">{media==="checking"?<Loader2 size={18} className="animate-spin"/>:"Check camera & microphone"}</button><button onClick={()=>void shareScreen()} disabled={screen==="checking"} className="inline-flex items-center gap-2 rounded border border-[#3155ff] px-4 py-2.5 text-[#3155ff]">{screen==="checking"?<Loader2 size={18} className="animate-spin"/>:<><MonitorUp size={18}/>Share screen</>}</button><button disabled={!ready} onClick={()=>void start()} className="rounded bg-[#153998] px-5 py-2.5 font-bold text-white disabled:bg-slate-400">Agree &amp; Start Test</button></footer>
  </div>
 </section>
}
