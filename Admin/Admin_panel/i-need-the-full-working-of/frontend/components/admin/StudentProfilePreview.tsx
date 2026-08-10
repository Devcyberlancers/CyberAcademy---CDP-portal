"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Download, ExternalLink, FileText, IdCard, UserRound, X, ZoomIn } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { StudentRecord } from "@/lib/admin-store";
import type { AdminJobApplicationActivity, StudentLearningRecord } from "@/lib/admin-api";

type Props = {
  student: StudentRecord;
  learningRecord: StudentLearningRecord | null;
  jobs: AdminJobApplicationActivity[];
  onClose: () => void;
};

type PreviewTab = "Edit Profile" | "Academic Information" | "Additional Information" | "Resume" | "Rewards" | "Mentor Information" | "Account Settings";
type EducationRecord = NonNullable<StudentRecord["educationDetails"]>[number];
type PreviewDocument = { name: string; source: string; label: string };
const tabs: PreviewTab[] = ["Edit Profile", "Academic Information", "Additional Information", "Resume", "Rewards", "Mentor Information", "Account Settings"];

export function StudentProfilePreview({ student, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("Academic Information");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [document, setDocument] = useState<PreviewDocument | null>(null);
  const profile = student as StudentRecord & { photo_data_url?: string };
  const photo = profile.photoDataUrl || profile.photo_data_url || "";
  const education = student.educationDetails ?? [];
  const resumeSource = student.resumeDataUrl || student.resumeUrl || "";

  return <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-slate-950/60 p-0 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${student.name} read-only profile preview`}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} className="flex h-full w-full flex-col overflow-hidden bg-[#f6f8fc]">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e1e5ee] bg-white px-5 sm:px-8">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3155ff]">Admin verification · read-only student view</p><h2 className="mt-0.5 text-lg font-bold text-[#07142f]">Student profile preview</h2></div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-[#dfe4f2] text-[#5a6475] hover:bg-slate-50" aria-label="Close profile preview"><X size={20}/></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <section className="mx-auto w-full max-w-[1720px] overflow-hidden rounded-[10px] bg-white shadow-sm">
            <div className="relative h-[190px] overflow-hidden bg-[linear-gradient(180deg,#9ad8eb,#ffd2a1_72%,#f36e4d)]">
              <div className="absolute inset-x-0 top-8 h-32 bg-[linear-gradient(170deg,rgba(255,255,255,.55),transparent_52%),radial-gradient(circle_at_62%_22%,rgba(255,255,255,.72)_0_16px,transparent_17px)]" />
              <div className="absolute bottom-0 left-0 h-14 w-full bg-[#e6673f]/70" />
              <div className="absolute bottom-0 right-16 h-36 w-20 rounded-t-full bg-[#345c6a]" />
            </div>
            <div className="grid gap-6 px-4 pb-8 sm:px-6 lg:grid-cols-[405px_1fr]">
              <section className="-mt-16 rounded-[10px] bg-white p-6 text-center shadow-[0_18px_55px_rgba(17,24,74,.12)]">
                <button type="button" onClick={() => photo && setPhotoOpen(true)} disabled={!photo} className="group relative mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-[#f0f6ff] disabled:cursor-default">
                  {photo ? <img src={photo} alt={`${student.name} profile`} className="h-full w-full object-cover"/> : <UserRound size={74} className="text-[#0e9fb5]"/>}
                  {photo ? <span className="absolute inset-0 grid place-items-center bg-slate-950/40 opacity-0 transition group-hover:opacity-100"><ZoomIn size={22} className="text-white"/></span> : null}
                </button>
                <span className="mt-3 inline-flex rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#3155ff]">Read only</span>
                <h1 className="mt-5 text-2xl font-bold text-[#07142f]">{student.name || "Student Profile"}</h1>
                <p className={`mt-2 text-lg font-semibold ${approvalLabel(student.status).startsWith("Approved") ? "text-[#43b92f]" : "text-amber-600"}`}>{approvalLabel(student.status)}</p>
                {student.updatedAt ? <p className="mt-2 text-xs font-medium text-[#6c7280]">Last updated {formatIst(student.updatedAt)}</p> : null}
                <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-[#d7d7d7]" />
                <div className="mt-8 text-left"><h2 className="mb-5 text-lg font-bold">Personal Information</h2><InfoLine label="Name" value={student.name}/><InfoLine label="Registration Number *" value={student.regNo}/><InfoLine label="Email *" value={student.email}/><InfoLine label="Phone *" value={student.phone}/><InfoLine label="Gender *" value={student.gender}/><InfoLine label="Date of Birth *" value={student.dateOfBirth}/><InfoLine label="Tag" value={student.tag || student.module}/></div>
              </section>
              <div className="min-w-0 pt-5">
                <div className="grid gap-3 md:grid-cols-3"><SummaryPill icon={<ChevronLeft size={18}/>} label="Batch *" value={student.batch}/><SummaryPill icon={<IdCard size={18}/>} label="Department *" value={student.branch}/><SummaryPill icon={<IdCard size={18}/>} label="College *" value={student.college}/></div>
                <div className="mt-8 flex flex-wrap gap-3">{tabs.map((tab)=><button key={tab} type="button" onClick={()=>setActiveTab(tab)} className={`rounded-md px-4 py-3 text-sm font-semibold transition ${activeTab===tab?"bg-[#3155ff] text-white":"text-[#5a5f68] hover:bg-[#f7f8fc]"}`}>{tab}</button>)}</div>
                <section className="mt-6 min-h-[410px] bg-white p-5 shadow-sm sm:p-8"><div className="mb-6 flex items-center justify-between gap-4"><h2 className="text-xl font-bold">{activeTab}</h2><span className="rounded-full border border-[#dfe4f2] px-3 py-1 text-xs font-bold text-[#657083]">Viewing as administrator</span></div>
                  {activeTab === "Edit Profile" ? <ReadOnlyGrid rows={[["Full Name *",student.name],["Cyberlancers ID",student.cyberlancersId],["Registration Number *",student.regNo],["Email *",student.email],["Phone *",student.phone],["Gender *",student.gender],["Date of Birth *",student.dateOfBirth],["Batch *",student.batch],["College *",student.college],["Department *",student.branch]]}/> : null}
                  {activeTab === "Academic Information" ? <ReadOnlyGrid rows={[["Batch *",student.batch],["Department *",student.branch],["College *",student.college],["Registration Number *",student.regNo]]}/> : null}
                  {activeTab === "Additional Information" ? <div className="grid gap-5">{education.length ? education.map((record,index)=><EducationPreview key={`${record.level}-${index}`} record={record} onView={(doc)=>setDocument(doc)} onDownload={downloadDocument}/>) : <EmptyState text="The student has not added education details yet."/>}</div> : null}
                  {activeTab === "Resume" ? <div className="grid gap-5">{resumeSource ? <DocumentRow document={{ name: student.resumeFileName || "Student resume", source: resumeSource, label: "Resume" }} onView={setDocument} onDownload={downloadDocument}/> : <EmptyState text="No resume has been uploaded."/>}<ReadOnlyField label="Portfolio Link" value={student.portfolioUrl}/>{student.portfolioUrl ? <a href={externalUrl(student.portfolioUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-[#3155ff]">Open portfolio <ExternalLink size={16}/></a> : null}</div> : null}
                  {activeTab === "Rewards" ? <EmptyState text="No rewards added yet."/> : null}
                  {activeTab === "Mentor Information" ? <ReadOnlyGrid rows={[["Mentor Name",student.mentorName]]}/> : null}
                  {activeTab === "Account Settings" ? <ReadOnlyGrid rows={[["Email *",student.email],["Approval Status",approvalLabel(student.status)],["Last Login",student.lastLogin]]}/> : null}
                </section>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
      {photoOpen && photo ? <ImageViewer source={photo} name={`${student.name} profile photo`} onClose={()=>setPhotoOpen(false)}/> : null}
      {document ? <DocumentViewer document={document} onClose={()=>setDocument(null)} onDownload={downloadDocument}/> : null}
    </motion.div>
  </AnimatePresence>;
}

function EducationPreview({ record, onView, onDownload }: { record: EducationRecord; onView: (document: PreviewDocument)=>void; onDownload: (document: PreviewDocument)=>Promise<void> }) {
  const name=record.markscardFileName || `${record.level || "Education"} markscard`; const document=record.markscardDataUrl ? {name,source:record.markscardDataUrl,label:`${record.level || "Education"} markscard`} : null;
  return <section className="rounded-lg border border-[#e1e5ee] bg-[#fafbfe] p-5"><h3 className="text-base font-bold text-[#07142f]">{record.level || "Education"}</h3><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Institution" value={record.institution}/><Detail label="Programme" value={record.programme === "Other" ? record.customProgramme : record.programme}/><Detail label="Year from" value={record.yearFrom}/><Detail label="Year to" value={record.yearTo}/><Detail label="Score" value={record.score}/></div>{document?<div className="mt-5"><DocumentRow document={document} onView={onView} onDownload={onDownload}/></div>:<p className="mt-4 text-sm text-[#747b8a]">No markscard uploaded.</p>}</section>;
}
function DocumentRow({ document, onView, onDownload }: { document: PreviewDocument; onView: (document: PreviewDocument)=>void; onDownload: (document: PreviewDocument)=>Promise<void> }) { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e1e5ee] bg-white px-4 py-3"><span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-[#07142f]"><FileText size={18} className="shrink-0 text-[#3155ff]"/><span className="truncate">{document.name}</span></span><span className="flex gap-2"><button type="button" onClick={()=>onView(document)} className="rounded-md border border-[#cfd8ff] px-4 py-2 text-xs font-bold text-[#3155ff]">View</button><button type="button" onClick={()=>void onDownload(document)} className="inline-flex items-center gap-1 rounded-md bg-[#3155ff] px-4 py-2 text-xs font-bold text-white"><Download size={14}/>Download</button></span></div>; }
function DocumentViewer({ document, onClose, onDownload }: { document: PreviewDocument; onClose: ()=>void; onDownload: (document: PreviewDocument)=>Promise<void> }) {
  const [url,setUrl]=useState(""); const [error,setError]=useState("");
  useEffect(()=>{let objectUrl="";let active=true;(async()=>{try{if(document.source.startsWith("data:")){const blob=await (await fetch(document.source)).blob();objectUrl=URL.createObjectURL(blob);if(active)setUrl(objectUrl);}else if(active)setUrl(document.source);}catch{if(active)setError("This document could not be prepared for viewing.");}})();return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[document]);
  const kind=documentKind(document.name,document.source);
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/75 p-3" role="dialog" aria-modal="true"><div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"><header className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-[#3155ff]">{document.label}</p><h3 className="truncate font-bold text-[#07142f]">{document.name}</h3></div><div className="flex gap-2"><button type="button" onClick={()=>void onDownload(document)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#3155ff] px-4 text-sm font-bold text-white"><Download size={16}/>Download</button><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border" aria-label="Close document"><X size={19}/></button></div></header><div className="min-h-0 flex-1 bg-[#eef1f6] p-3">{error?<div className="grid h-full place-items-center text-sm font-semibold text-red-600">{error}</div>:!url?<div className="grid h-full place-items-center text-sm font-semibold text-[#657083]">Preparing document…</div>:kind==="image"?<img src={url} alt={document.name} className="mx-auto h-full max-w-full object-contain"/>:kind==="pdf"?<iframe src={url} title={document.name} className="h-full w-full rounded bg-white"/>:<div className="grid h-full place-items-center text-center"><div><FileText size={52} className="mx-auto text-[#3155ff]"/><p className="mt-4 font-bold">This file type cannot be rendered securely in the browser.</p><p className="mt-2 text-sm text-[#657083]">Download the file to view it in its compatible application.</p></div></div>}</div></div></div>;
}
function ImageViewer({ source, name, onClose }: { source:string; name:string; onClose:()=>void }) { return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/75 p-4" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><div className="relative max-h-[90vh] max-w-4xl rounded-2xl bg-white p-3"><button type="button" onClick={onClose} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white shadow" aria-label="Close image"><X size={18}/></button><img src={source} alt={name} className="max-h-[84vh] max-w-full rounded-xl object-contain"/></div></div>; }
function ReadOnlyGrid({ rows }: { rows:Array<[string,string|undefined]> }) { return <div className="grid gap-5 md:grid-cols-2">{rows.map(([label,value])=><ReadOnlyField key={label} label={label} value={value}/>)}</div>; }
function ReadOnlyField({ label, value }: { label:string; value?:string }) { return <div><p className="mb-2 text-sm font-bold text-[#333b4d]">{label}</p><div className="flex min-h-14 items-center rounded-md border border-[#dbe0e9] bg-[#fbfcfe] px-4 text-sm font-medium text-[#07142f]">{value || "—"}</div></div>; }
function SummaryPill({ icon,label,value }: { icon:ReactNode;label:string;value?:string }) { return <div className="flex min-h-[92px] items-center gap-4 rounded-xl border border-[#dfe4f2] bg-white px-5 shadow-sm"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eef2ff] text-[#3155ff]">{icon}</span><span className="font-semibold text-[#50586a]">{label}</span><strong className="ml-auto text-[#07142f]">{value || "—"}</strong></div>; }
function InfoLine({ label,value }: { label:string;value?:string }) { return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-3 py-3 text-sm"><span className="text-[#626b7c]">{label}</span><strong className="break-words text-[#07142f]">{value || "—"}</strong></div>; }
function Detail({ label,value }: { label:string;value?:string }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-[#7a8292]">{label}</p><p className="mt-1 break-words text-sm font-bold text-[#172033]">{value || "—"}</p></div>; }
function EmptyState({ text }: { text:string }) { return <p className="rounded-lg bg-[#f7f8fb] p-5 text-sm font-medium text-[#657083]">{text}</p>; }
function approvalLabel(status:string) { const value=status.toLowerCase(); return value.includes("approved")||value==="in progress"||value==="advanced" ? "Approved by Admin" : value.includes("suspend") ? "Account Suspended" : "Approval Pending by Admin"; }
function formatIst(value:string) { const date=new Date(value); return Number.isNaN(date.getTime())?"—":`${date.toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})} IST`; }
function externalUrl(value:string) { return /^https?:\/\//i.test(value)?value:`https://${value}`; }
function documentKind(name:string,source:string):"pdf"|"image"|"other" { const clean=name.toLowerCase(); const mime=source.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase()||""; if(mime.includes("pdf")||clean.endsWith(".pdf"))return "pdf"; if(mime.startsWith("image/")||/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(clean))return "image"; return "other"; }
async function downloadDocument(document:PreviewDocument) { let href=document.source;let objectUrl="";try{if(document.source.startsWith("data:")){const blob=await(await fetch(document.source)).blob();objectUrl=URL.createObjectURL(blob);href=objectUrl;}const anchor=window.document.createElement("a");anchor.href=href;anchor.download=document.name||"document";anchor.rel="noreferrer";window.document.body.appendChild(anchor);anchor.click();anchor.remove();}catch{window.open(document.source,"_blank","noopener,noreferrer");}finally{if(objectUrl)setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);}}