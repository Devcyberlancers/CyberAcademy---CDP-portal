"use client";

import { Check, Loader2, Mic, MonitorUp, ShieldCheck, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { enterFullscreen } from "@/lib/fullscreen-manager";
import { getPreparedProctoringEngine, prepareProctoring, stopPreparedProctoring } from "@/lib/proctoring/proctoring-engine";
import { stopProctoringStreams } from "@/lib/proctoring/media-streams";
import type { ProctoringConfig } from "@/lib/proctoring/types";

type Props={title:string;onClose:()=>void;onProceed:()=>void|Promise<void>;config?:Partial<ProctoringConfig>};
type StreamWindow=Window&{__cyberAcademyScreenStream?:MediaStream;__cyberAcademyMediaStream?:MediaStream};
const terms=[
 "It is not advisable to attempt tests from a mobile phone. Use a laptop or desktop.",
 "Disconnecting from the internet can pause or automatically submit the test.",
 "Use a current version of Chrome, Edge, Firefox, Safari, or Opera.",
 "Enable cookies and allow camera, microphone, screen sharing, and fullscreen permissions.",
 "Maintain uninterrupted internet with adequate download and upload speed.",
 "Set the system clock to GMT +05:30 (Mumbai, Kolkata, Chennai, New Delhi).",
 "No tab switches, other windows, notifications, or pop-ups are allowed during the test.",
 "Clipboard actions and browser navigation are blocked in secure test mode.",
];
function environment(){
 const agent=navigator.userAgent,match=agent.match(/(?:Edg|OPR|Firefox|Chrome)\/(\d+)/i)||agent.match(/Version\/(\d+).*Safari/i);
 const name=/Edg\//i.test(agent)?"Edge":/OPR\//i.test(agent)?"Opera":/Firefox\//i.test(agent)?"Firefox":/Chrome\//i.test(agent)?"Chrome":/Safari\//i.test(agent)?"Safari":"Unsupported";
 const version=Number(match?.[1]||0),zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 return{browser:`${name} ${version}`,supported:name!=="Unsupported"&&version>=(name==="Safari"?12:60),desktop:!/Android|iPhone|iPad|iPod|Mobile/i.test(agent)&&innerWidth>=768,ist:new Date().getTimezoneOffset()===-330||["Asia/Calcutta","Asia/Kolkata"].includes(zone)};
}
export function stopExamStreams(){
 void stopPreparedProctoring();
 stopProctoringStreams();
}

export function ExamReadinessDialog({title,onClose,onProceed,config}:Props){
 const [stage,setStage]=useState(0),[checking,setChecking]=useState(false),[validity,setValidity]=useState<string[]>([]),[mediaReady,setMediaReady]=useState(false),[screenReady,setScreenReady]=useState(false),[monitoringReady,setMonitoringReady]=useState(false),[error,setError]=useState(""),[countdown,setCountdown]=useState<number|null>(null);
 const videoRef=useRef<HTMLVideoElement>(null),configRef=useRef(config),env=environment();
 configRef.current=config;
 const systemChecks=[
  ["Supported browser",env.browser,env.supported],
  ["Secure HTTPS connection","Protected browser permissions are available",window.isSecureContext||["localhost","127.0.0.1"].includes(location.hostname)],
  ["Internet connection",navigator.onLine?"Online":"Offline",navigator.onLine],
  ["Laptop or desktop","Mobile devices cannot start this test",env.desktop],
  ["Fullscreen","Fullscreen exam mode is supported",Boolean(document.fullscreenEnabled)],
  ["Cookies",navigator.cookieEnabled?"Enabled":"Disabled",navigator.cookieEnabled],
  ["IST timezone","GMT +05:30 required",env.ist],
 ] as const;
 const systemReady=systemChecks.every((item)=>item[2]);
 useEffect(()=>{stopProctoringStreams();void stopPreparedProctoring()},[]);
 useEffect(()=>{if(stage!==1)return;let cancelled=false;setChecking(true);setValidity([]);const run=async()=>{for(const message of ["Validating test status","Checking attempt availability","Checking test schedule and duration","Confirming student authentication"]){if(cancelled)return;setValidity((items)=>[...items,message]);await new Promise((resolve)=>window.setTimeout(resolve,550))}if(!cancelled)setChecking(false)};void run();return()=>{cancelled=true}},[stage]);
 useEffect(()=>{if(stage!==3||!mediaReady||!videoRef.current)return;const stream=(window as StreamWindow).__cyberAcademyMediaStream;if(stream){videoRef.current.srcObject=stream;void videoRef.current.play()}},[stage,mediaReady]);
 useEffect(()=>{if(stage!==5||!mediaReady||!screenReady)return;let cancelled=false;setChecking(true);setMonitoringReady(false);setError("");void prepareProctoring(configRef.current).then(()=>{if(!cancelled)setMonitoringReady(true)}).catch((reason:unknown)=>{if(!cancelled)setError(reason instanceof Error?reason.message:"Assessment monitoring could not be initialized.")}).finally(()=>{if(!cancelled)setChecking(false)});return()=>{cancelled=true}},[stage,mediaReady,screenReady]);
 function close(){stopExamStreams();onClose()}
 async function allowMedia(){
  setChecking(true);setError("");
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360},facingMode:"user"},audio:{echoCancellation:true,noiseSuppression:true}});
   (window as StreamWindow).__cyberAcademyMediaStream?.getTracks().forEach((track)=>track.stop());
   (window as StreamWindow).__cyberAcademyMediaStream=stream;setMediaReady(true);
  }catch{setMediaReady(false);setError("Camera and microphone permission is required. Allow access and try again.")}
  finally{setChecking(false)}
 }
 async function allowScreen(){
  setChecking(true);setError("");
  try{
   const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
   const track=stream.getVideoTracks()[0];if(!track)throw new Error("No screen selected");
   (window as StreamWindow).__cyberAcademyScreenStream?.getTracks().forEach((item)=>item.stop());
   (window as StreamWindow).__cyberAcademyScreenStream=stream;
   track.addEventListener("ended",()=>setScreenReady(false),{once:true});setScreenReady(true);
  }catch{setScreenReady(false);setError("Select the screen or test window in the browser sharing prompt.")}
  finally{setChecking(false)}
 }
 async function start(){
  if(!mediaReady||!screenReady||!systemReady||!monitoringReady)return;
  try{
   await enterFullscreen();
   await getPreparedProctoringEngine()?.start();
   for(let value=3;value>0;value-=1){setCountdown(value);await new Promise((resolve)=>window.setTimeout(resolve,1000))}
   setCountdown(0);await onProceed();onClose();
  }catch{setCountdown(null);setError("Fullscreen permission is required. Keep camera, microphone, and screen sharing active.")}
 }
 if(countdown!==null)return <section className="fixed inset-0 z-[130] grid place-items-center bg-[#07142f] text-white"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[.24em] text-blue-200">Secure test starting</p><div className="mx-auto mt-6 grid h-36 w-36 place-items-center rounded-full border-4 border-white/20 text-7xl font-bold shadow-[0_0_0_10px_rgba(49,85,255,.25)]">{countdown||"GO"}</div><p className="mt-6 text-lg">Camera, microphone, screen sharing, and tab monitoring are active.</p></div></section>;
 return <section className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
  <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[18px] bg-white shadow-2xl">
   <header className="mx-8 flex items-center justify-between border-b py-6"><div><h2 className="text-[22px] font-bold">{stage===0?"Terms And Instructions":stage===1?"Checking Test Validity And Availability":stage===2?"Browser And System Check":stage===3?"Checking Webcam, Mic And Authentication":stage===4?"Screen Access Check":"Ready To Begin"}</h2><p className="mt-1 text-sm text-slate-500">{title}</p></div><button onClick={close} aria-label="Close"><X size={27} className="text-slate-500"/></button></header>
   <div className="min-h-[440px] overflow-y-auto px-8 py-7">
    {stage===0?<><h3 className="text-xl font-bold text-slate-600">Please carefully read and agree to the below:</h3><ul className="mt-7 space-y-4">{terms.map((item)=><li key={item} className="flex gap-4 text-[15px] leading-6 text-slate-600"><span className="mt-2 h-3 w-3 shrink-0 rotate-45 bg-[#969696]"/>{item}</li>)}</ul></>:null}
    {stage===1?<div className="mx-auto max-w-3xl"><ShieldCheck className="mx-auto h-32 w-32 text-[#3155ff]" strokeWidth={1.2}/><div className="mt-6 divide-y rounded-lg bg-[#f6f7fb]">{validity.map((item,index)=><div key={item} className="flex items-center gap-4 px-5 py-4"><Check className="text-emerald-600" size={20}/><span>{item}</span>{checking&&index===validity.length-1?<Loader2 className="ml-auto animate-spin" size={18}/>:null}</div>)}</div></div>:null}
    {stage===2?<div className="mx-auto max-w-3xl divide-y rounded-lg border">{systemChecks.map(([label,detail,ok])=><div key={label} className="flex items-center gap-4 px-5 py-4"><span className={`grid h-6 w-6 place-items-center rounded border ${ok?"border-emerald-600 bg-emerald-600 text-white":"border-red-500 text-red-600"}`}>{ok?<Check size={15}/>:<X size={15}/>}</span><div><b>{label}</b><p className="text-sm text-slate-600">{detail}</p></div></div>)}</div>:null}
    {stage===3?<div className="mx-auto max-w-3xl"><div className="grid min-h-64 place-items-center overflow-hidden rounded-xl bg-slate-950">{mediaReady?<video ref={videoRef} muted playsInline className="max-h-72 w-full object-contain"/>:<Video className="h-24 w-24 text-white/60" strokeWidth={1}/>}</div><div className="mt-5 flex items-center gap-3 rounded-lg bg-[#f6f7fb] p-4"><Mic className={mediaReady?"text-emerald-600":"text-slate-500"}/><span>{mediaReady?"Camera and microphone are live and will remain on until submission.":"Allow camera and microphone to continue."}</span></div></div>:null}
    {stage===4?<div className="mx-auto max-w-3xl text-center"><MonitorUp className="mx-auto h-36 w-36 text-[#3155ff]" strokeWidth={1}/><div className="mt-6 rounded-lg bg-[#f6f7fb] p-5 text-left"><b>{screenReady?"Screen sharing active":"Screen access required"}</b><p className="mt-2 text-sm text-slate-600">{screenReady?"Do not stop sharing before submitting the test.":"Click Share Screen and select the screen or window containing this test."}</p></div></div>:null}
    {stage===5?<div className="mx-auto max-w-xl py-16 text-center"><ShieldCheck className={`mx-auto h-28 w-28 ${monitoringReady?"text-emerald-600":"text-[#3155ff]"}`}/><h3 className="mt-5 text-2xl font-bold">{checking?"Preparing assessment monitoring...":monitoringReady?"Proctoring ready.":"Assessment monitoring could not be initialized."}</h3><p className="mt-3 text-slate-600">MediaPipe face detection, YOLO person and phone detection, browser monitoring, audio activity, camera, microphone, and screen sharing are checked using real detector state.</p></div>:null}
    {error?<p className="mx-auto mt-5 max-w-3xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>:null}
   </div>
   <footer className="border-t bg-white px-8 py-5"><div className="flex justify-end gap-3">{stage===0?<><button onClick={close} className="rounded border px-7 py-2.5">Close</button><button onClick={()=>setStage(1)} className="rounded bg-[#3155ff] px-7 py-2.5 font-bold text-white">Agree &amp; Proceed</button></>:null}{stage===1?<button disabled={checking} onClick={()=>setStage(2)} className="rounded bg-[#3155ff] px-7 py-2.5 font-bold text-white disabled:bg-slate-400">Continue</button>:null}{stage===2?<button disabled={!systemReady} onClick={()=>setStage(3)} className="rounded bg-[#3155ff] px-7 py-2.5 font-bold text-white disabled:bg-slate-400">Continue</button>:null}{stage===3?<><button onClick={()=>void allowMedia()} disabled={checking} className="rounded border border-[#3155ff] px-6 py-2.5 text-[#3155ff]">{checking?"Checking...":mediaReady?"Check again":"Allow camera & microphone"}</button><button disabled={!mediaReady} onClick={()=>setStage(4)} className="rounded bg-[#3155ff] px-7 py-2.5 font-bold text-white disabled:bg-slate-400">Continue</button></>:null}{stage===4?<><button onClick={()=>void allowScreen()} disabled={checking} className="rounded border border-[#3155ff] px-6 py-2.5 text-[#3155ff]">{checking?"Checking...":screenReady?"Share again":"Share Screen"}</button><button disabled={!screenReady} onClick={()=>setStage(5)} className="rounded bg-[#3155ff] px-7 py-2.5 font-bold text-white disabled:bg-slate-400">Continue</button></>:null}{stage===5?<button disabled={!monitoringReady||checking} onClick={()=>void start()} className="rounded bg-[#153998] px-8 py-2.5 font-bold text-white disabled:bg-slate-400">{checking?"Loading models...":"Enter Fullscreen & Start"}</button>:null}</div><div className="mt-5 flex justify-center gap-3">{Array.from({length:6},(_,index)=><span key={index} className={`h-1.5 w-6 rounded-full ${index===stage?"bg-[#3155ff]":"bg-slate-300"}`}/>)}</div></footer>
  </div>
 </section>
}
