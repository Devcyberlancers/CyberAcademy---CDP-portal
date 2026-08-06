"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronLeft, Edit3, FileText, IdCard, Trash2, Upload, UserRound } from "lucide-react";
import { DashboardShell, type StudentSection } from "@/components/dashboard-shell";
import { Card } from "@/components/ui";
import {
  defaultStudentAccount,
  fetchStudentProfile,
  persistStudentProfile,
  readStudentAccount,
  type StudentAccount,
  type StudentEducation
} from "@/lib/student-account";

const tabs = ["Edit Profile", "Academic Information", "Additional Information", "Resume", "Rewards", "Mentor Information", "Account Settings"] as const;
type ProfileTab = (typeof tabs)[number];

export function ProfilePortal() {
  const [student, setStudent] = useState<StudentAccount>(defaultStudentAccount);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    const localStudent = readStudentAccount();
    setStudent(localStudent);
    if (localStudent.email) {
      void fetchStudentProfile(localStudent.email).then((profile) => {
        if (profile) setStudent(profile);
      }).catch(() => undefined);
    }
  }, []);

  async function updateStudent(nextStudent: StudentAccount) {
    setStudent(nextStudent);
    setStudent(await persistStudentProfile(nextStudent));
  }

  function goToDashboard(section: StudentSection) {
    window.location.href = section === "dashboard" ? "/dashboard/student" : "/dashboard/student";
  }

  return (
    <DashboardShell
      activeSection="dashboard"
      onSectionChange={goToDashboard}
      searchValue={searchValue}
      onSearchValueChange={setSearchValue}
      onSearchSubmit={() => {
        const term = searchValue.trim();
        if (term) window.location.href = `/dashboard/student?search=${encodeURIComponent(term)}`;
      }}
      student={student}
    >
      <ProfileView student={student} onStudentChange={updateStudent} />
    </DashboardShell>
  );
}

function ProfileView({ student, onStudentChange }: { student: StudentAccount; onStudentChange: (student: StudentAccount) => Promise<void> }) {
  const [draft, setDraft] = useState<StudentAccount>(student);
  const [activeTab, setActiveTab] = useState<ProfileTab>("Academic Information");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [photoSource, setPhotoSource] = useState("");
  const [photoCrop, setPhotoCrop] = useState({ x: 0, y: 0, size: 0.72 });
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);

  useEffect(() => {
    setDraft(student);
    setPhotoSource(student.photoDataUrl || "");
    setPhotoCrop({ x: 0, y: 0, size: 0.72 });
    setIsEditingPhoto(false);
  }, [student]);

  function setField(field: keyof StudentAccount, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "fullName" ? { firstName: value.trim().split(/\s+/)[0] || "" } : {})
    }));
    setSaved(false);
    setSaveError("");
  }

  function updateEducation(level: StudentEducation["level"], patch: Partial<StudentEducation>) {
    setDraft((current) => {
      const education = current.education || [];
      const existing = education.find((item) => item.level === level) || { level };
      return { ...current, education: [...education.filter((item) => item.level !== level), { ...existing, ...patch }] };
    });
    setSaved(false);
    setSaveError("");
  }

  function educationFor(level: StudentEducation["level"]) {
    return draft.education?.find((item) => item.level === level) || { level };
  }

  async function updateProfilePhoto(file: File | undefined) {
    if (!file) return;
    setSaved(false);
    setSaveError("");
    if (!file.type.startsWith("image/")) {
      setSaveError("Please select a valid image file.");
      return;
    }
    try {
      const source = await readFileAsDataUrl(file);
      const photoDataUrl = await prepareProfilePhoto(source, 0, 0, 0.72);
      setPhotoSource(source);
      setPhotoCrop({ x: 0, y: 0, size: 0.72 });
      setIsEditingPhoto(true);
      setDraft((current) => ({ ...current, photoDataUrl }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The selected photo could not be processed.");
    }
  }

  function updateResume(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraft((current) => ({
          ...current,
          resumeFileName: file.name,
          resumeDataUrl: reader.result as string
        }));
        setSaved(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function applyPhotoAdjustment() {
    if (!photoSource) return;
    try {
      setDraft((current) => ({ ...current, photoDataUrl: current.photoDataUrl }));
      const photoDataUrl = await prepareProfilePhoto(photoSource, photoCrop.x, photoCrop.y, photoCrop.size);
      setDraft((current) => ({ ...current, photoDataUrl }));
      setSaved(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The photo adjustment could not be applied.");
    }
  }

  function updateMarkscard(level: StudentEducation["level"], file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setSaveError("Upload a PDF or image markscard.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("Each markscard must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") updateEducation(level, { markscardFileName: file.name, markscardDataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  }

  function removeMarkscard(level: StudentEducation["level"]) {
    updateEducation(level, { markscardFileName: "", markscardDataUrl: "" });
  }

  async function saveProfile() {
    const missing = profileCompletionIssue(draft);
    if (missing) {
      setActiveTab(missing.tab);
      setSaveError(missing.message);
      return;
    }
    setIsSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      await onStudentChange(draft);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const higherSecondary = draft.education?.find((item) => item.level === "PUC" || item.level === "Diploma");

  return (
    <div className="w-full">
      <section className="relative overflow-hidden rounded-[10px] bg-white shadow-sm">
        <div className="relative h-[190px] overflow-hidden bg-[linear-gradient(180deg,#9ad8eb,#ffd2a1_72%,#f36e4d)]">
          <div className="absolute inset-x-0 top-8 h-32 bg-[linear-gradient(170deg,rgba(255,255,255,.55),transparent_52%),radial-gradient(circle_at_62%_22%,rgba(255,255,255,.72)_0_16px,transparent_17px)]" />
          <div className="absolute bottom-0 left-0 h-14 w-full bg-[#e6673f]/70" />
          <div className="absolute bottom-0 right-16 h-36 w-20 rounded-t-full bg-[#345c6a]" />
        </div>

        <div className="grid gap-6 px-6 pb-8 lg:grid-cols-[405px_1fr]">
          <Card className="-mt-16 rounded-[10px] border-0 bg-white p-6 text-center shadow-[0_18px_55px_rgba(17,24,74,.12)]">
            <label className="relative mx-auto flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#f0f6ff]">
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => updateProfilePhoto(event.target.files?.[0])} />
              {draft.photoDataUrl ? (
                <Image src={draft.photoDataUrl} alt="Profile photo" fill unoptimized className="object-cover" />
              ) : (
                <UserRound size={74} className="text-[#0e9fb5]" />
              )}
              <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#3155ff] shadow">
                <Camera size={17} />
              </span>
            </label>
            {photoSource && <><button type="button" onClick={() => setIsEditingPhoto(true)} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#3155ff]"><Edit3 size={14} />Edit photo</button>{isEditingPhoto && <PhotoCropEditor source={photoSource} crop={photoCrop} onCropChange={setPhotoCrop} onApply={() => { void applyPhotoAdjustment(); setIsEditingPhoto(false); }} onCancel={() => setIsEditingPhoto(false)} />}</>}

            <h1 className="mt-6 text-2xl font-bold text-[#07142f]">{draft.fullName || "Student Profile"}</h1>
            <p className="mt-2 text-lg font-semibold text-[#43b92f]">{approvalLabel(draft.status)}</p>
            <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-[#d7d7d7]" />

            <div className="mt-8 text-left">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold">Personal Information</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab("Edit Profile")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#3155ff]"
                >
                  <Edit3 size={15} />
                  Edit
                </button>
              </div>
              <InfoLine label="Name" value={draft.fullName} />
              <InfoLine label="Registration Number *" value={draft.registrationNumber} />
              <InfoLine label="Email *" value={draft.email} />
              <InfoLine label="Phone *" value={draft.phone} />
              <InfoLine label="Gender *" value={draft.gender} />
              <InfoLine label="Date of Birth *" value={draft.dateOfBirth} />
              <InfoLine label="Tag" value={draft.tag} />
            </div>
          </Card>

          <div className="pt-5">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryPill icon={<ChevronLeft size={18} />} label="Batch *" value={draft.batch} />
              <SummaryPill icon={<IdCard size={18} />} label="Department *" value={draft.department} />
              <SummaryPill icon={<IdCard size={18} />} label="College *" value={draft.college} />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? "bg-[#3155ff] text-white" : "bg-transparent text-[#5a5f68] hover:bg-white"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <Card className="mt-6 rounded-none border-0 bg-white p-8 shadow-sm">
              <h2 className="mb-6 text-xl font-bold">{activeTab}</h2>
              {activeTab === "Edit Profile" && (
                <FormGrid>
                  <TextField label="Full Name *" value={draft.fullName} onChange={(value) => setField("fullName", value)} />
                  <TextField label="Cyberlancers ID" value={draft.cyberlancersId} onChange={(value) => setField("cyberlancersId", value)} />
                  <TextField label="Registration Number *" value={draft.registrationNumber} onChange={(value) => setField("registrationNumber", value)} />
                  <TextField label="Email *" value={draft.email} onChange={(value) => setField("email", value)} />
                  <TextField label="Phone *" value={draft.phone} onChange={(value) => setField("phone", value)} />
                  <SelectField label="Gender *" value={draft.gender} onChange={(value) => setField("gender", value)} options={["Female", "Male", "Non-binary", "Prefer not to say"]} />
                  <TextField label="Date of Birth *" type="date" value={draft.dateOfBirth} onChange={(value) => setField("dateOfBirth", value)} />
                  <TextField label="Batch *" value={draft.batch} onChange={(value) => setField("batch", value)} />
                  <TextField label="College *" value={draft.college} onChange={(value) => setField("college", value)} />
                  <TextField label="Department *" value={draft.department} onChange={(value) => setField("department", value)} />
                </FormGrid>
              )}

              {activeTab === "Academic Information" && (
                <FormGrid>
                  <TextField label="Batch *" value={draft.batch} onChange={(value) => setField("batch", value)} />
                  <TextField label="Department *" value={draft.department} onChange={(value) => setField("department", value)} />
                  <TextField label="College *" value={draft.college} onChange={(value) => setField("college", value)} />
                  <TextField label="Registration Number *" value={draft.registrationNumber} onChange={(value) => setField("registrationNumber", value)} />
                </FormGrid>
              )}

              {activeTab === "Additional Information" && (
                <div className="grid gap-6">
                  <EducationCard required title="Class 10" record={educationFor("Class 10")} onChange={(patch) => updateEducation("Class 10", patch)} onUpload={(file) => updateMarkscard("Class 10", file)} onRemove={() => removeMarkscard("Class 10")} />
                  <SelectField label="Higher-secondary qualification *" value={higherSecondary?.level || ""} onChange={(value) => {
                    setDraft((current) => ({ ...current, education: (current.education || []).filter((item) => item.level !== "PUC" && item.level !== "Diploma").concat(value ? [{ level: value as "PUC" | "Diploma" }] : []) }));
                    setSaved(false);
                  }} options={["PUC", "Diploma"]} emptyLabel="Not added" />
                  {draft.education?.some((item) => item.level === "PUC") && <EducationCard required title="PUC" record={educationFor("PUC")} onChange={(patch) => updateEducation("PUC", patch)} onUpload={(file) => updateMarkscard("PUC", file)} onRemove={() => removeMarkscard("PUC")} />}
                  {draft.education?.some((item) => item.level === "Diploma") && <EducationCard required title="Diploma" record={educationFor("Diploma")} onChange={(patch) => updateEducation("Diploma", patch)} onUpload={(file) => updateMarkscard("Diploma", file)} onRemove={() => removeMarkscard("Diploma")} />}
                  <EducationCard required title="Degree" record={educationFor("Degree")} onChange={(patch) => updateEducation("Degree", patch)} onUpload={(file) => updateMarkscard("Degree", file)} onRemove={() => removeMarkscard("Degree")} degree />
                  <EducationCard title="Master's degree" record={educationFor("Masters")} onChange={(patch) => updateEducation("Masters", patch)} onUpload={(file) => updateMarkscard("Masters", file)} onRemove={() => removeMarkscard("Masters")} masters />
                  <EducationCard title="PhD (optional)" record={educationFor("PhD")} onChange={(patch) => updateEducation("PhD", patch)} onUpload={(file) => updateMarkscard("PhD", file)} onRemove={() => removeMarkscard("PhD")} />
                </div>
              )}

              {activeTab === "Resume" && (
                <div className="grid gap-5">
                  <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#bfc8d8] bg-[#f8faff] px-5 py-8 text-center transition hover:border-[#3155ff]">
                    <input type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(event) => updateResume(event.target.files?.[0])} />
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2ff] text-[#3155ff]">
                      <Upload size={22} />
                    </span>
                    <span className="mt-3 text-sm font-bold text-[#07142f]">Upload Resume</span>
                    <span className="mt-1 text-xs text-[#747b8a]">PDF, DOC, or DOCX</span>
                  </label>

                  {(draft.resumeFileName || draft.resumeDataUrl) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e1e5ee] bg-white px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#07142f]">
                        <FileText size={18} className="text-[#3155ff]" />
                        {draft.resumeFileName || "Uploaded resume"}
                      </span>
                      <span className="flex items-center gap-3">
                        {draft.resumeDataUrl && <a href={draft.resumeDataUrl} download={draft.resumeFileName || "resume"} className="text-sm font-semibold text-[#3155ff]">Download</a>}
                        <button type="button" onClick={() => { setDraft((current) => ({ ...current, resumeFileName: "", resumeDataUrl: "" })); setSaved(false); }} className="text-sm font-semibold text-red-600">Remove</button>
                      </span>
                    </div>
                  )}

                  <div className="max-w-[520px]">
                    <div className="flex items-end gap-3"><div className="min-w-0 flex-1"><TextField label="Portfolio Link" value={draft.portfolioUrl} onChange={(value) => setField("portfolioUrl", value)} /></div>{draft.portfolioUrl && <button type="button" onClick={() => setField("portfolioUrl", "")} className="flex h-11 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-600"><Trash2 size={15} />Remove</button>}</div>
                  </div>
                </div>
              )}

              {activeTab === "Rewards" && <p className="text-sm font-semibold text-[#5a5f68]">No rewards added yet.</p>}

              {activeTab === "Mentor Information" && (
                <FormGrid>
                  <TextField label="Mentor Name" value={draft.mentorName} onChange={(value) => setField("mentorName", value)} />
                </FormGrid>
              )}

              {activeTab === "Account Settings" && (
                <FormGrid>
                  <TextField label="Email *" value={draft.email} onChange={(value) => setField("email", value)} />
                  <ReadOnlyField label="Approval Status" value={approvalLabel(draft.status)} />
                </FormGrid>
              )}

              <div className="mt-8 flex items-center">
                <button type="button" onClick={saveProfile} disabled={isSaving} className={`inline-flex min-w-[154px] items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(49,85,255,.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(49,85,255,.3)] disabled:cursor-not-allowed disabled:opacity-60 ${saved ? "bg-[#2fae63]" : "bg-[#3155ff] hover:bg-[#2447f1]"}`}>
                  {isSaving ? "Saving..." : saved ? <><Check size={17} />Profile saved</> : "Save Profile"}
                </button>
                {saveError && <span className="ml-3 text-sm font-semibold text-[#c03434]">{saveError}</span>}
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

function profileCompletionIssue(student: StudentAccount): { tab: ProfileTab; message: string } | null {
  const core: Array<[keyof StudentAccount, string, ProfileTab]> = [["fullName", "Full name", "Edit Profile"], ["registrationNumber", "Registration Number", "Edit Profile"], ["email", "Email", "Edit Profile"], ["phone", "Phone", "Edit Profile"], ["gender", "Gender", "Edit Profile"], ["dateOfBirth", "Date of Birth", "Edit Profile"], ["batch", "Batch", "Academic Information"], ["college", "College", "Academic Information"], ["department", "Department", "Academic Information"]];
  for (const [field, label, tab] of core) if (!String(student[field] || "").trim()) return { tab, message: `${label} is required. Complete all fields marked * before saving.` };
  const education = student.education || [];
  const complete = (level: StudentEducation["level"]) => {
    const item = education.find((record) => record.level === level);
    return Boolean(item?.institution?.trim() && item?.yearFrom?.trim() && item?.yearTo?.trim() && item?.score?.trim() && item?.markscardDataUrl?.trim());
  };
  if (!complete("Class 10")) return { tab: "Additional Information", message: "Complete Class 10 details and upload its markscard before saving." };
  if (!complete("PUC") && !complete("Diploma")) return { tab: "Additional Information", message: "Add complete PUC or Diploma details, including the markscard, before saving." };
  if (!complete("Degree")) return { tab: "Additional Information", message: "Complete Degree details and upload its markscard before saving." };
  return null;
}
const maxProfilePhotoDimension = 512;
const maxProfilePhotoDataUrlLength = 55_000;

async function prepareProfilePhoto(source: string, cropX: number, cropY: number, cropFraction: number): Promise<string> {
  const image = await loadImage(source);
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight) * Math.max(0.45, Math.min(0.9, cropFraction));
  const xPadding = Math.max(0, (image.naturalWidth - cropSize) / 2);
  const yPadding = Math.max(0, (image.naturalHeight - cropSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = maxProfilePhotoDimension;
  canvas.height = maxProfilePhotoDimension;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not process this photo.");

  context.drawImage(image, xPadding + cropX * xPadding, yPadding + cropY * yPadding, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.7, 0.58, 0.46, 0.34]) {
    const result = canvas.toDataURL("image/jpeg", quality);
    if (result.length <= maxProfilePhotoDataUrlLength) return result;
  }

  const smallerCanvas = document.createElement("canvas");
  smallerCanvas.width = Math.max(1, Math.round(canvas.width * 0.7));
  smallerCanvas.height = Math.max(1, Math.round(canvas.height * 0.7));
  const smallerContext = smallerCanvas.getContext("2d");
  if (!smallerContext) throw new Error("Your browser could not process this photo.");
  smallerContext.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
  const result = smallerCanvas.toDataURL("image/jpeg", 0.35);
  if (result.length > maxProfilePhotoDataUrlLength) {
    throw new Error("This photo is too detailed to store. Please choose a simpler or smaller image.");
  }
  return result;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The selected photo could not be read.")));
    reader.onerror = () => reject(new Error("The selected photo could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image format is not supported."));
    image.src = source;
  });
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 py-3 text-sm">
      <span className="text-[#5f6573]">{label}</span>
      <span className="truncate font-medium text-black">{value || "-"}</span>
    </div>
  );
}

function SummaryPill({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-md border border-[#e1e5ee] bg-white px-4 py-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#3155ff]">{icon}</span>
      <span className="text-sm font-semibold text-[#5a5f68]">{label}</span>
      <b className="ml-auto text-sm text-black">{value || "-"}</b>
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function TextField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#343946]">
      {label}
      <input
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#dbe0e9] px-3 text-sm outline-none transition focus:border-[#3155ff] focus:ring-2 focus:ring-[#3155ff]/15"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, emptyLabel = "Select an option" }: { label: string; value?: string; onChange: (value: string) => void; options: string[]; emptyLabel?: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#343946]">
      {label}
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-md border border-[#dbe0e9] bg-white px-3 text-sm outline-none transition focus:border-[#3155ff] focus:ring-2 focus:ring-[#3155ff]/15">
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string }) {
  return <div className="grid gap-2 text-sm font-semibold text-[#343946]"><span>{label}</span><span className="flex h-11 items-center rounded-md border border-[#dbe0e9] bg-[#f8faff] px-3 text-sm text-[#5a5f68]">{value || "Waiting for profile details"}</span></div>;
}

function EducationCard({ title, record, onChange, onUpload, onRemove, degree = false, masters = false, required = false }: { title: string; record: StudentEducation; onChange: (patch: Partial<StudentEducation>) => void; onUpload: (file: File | undefined) => void; onRemove: () => void; degree?: boolean; masters?: boolean; required?: boolean }) {
  const degreeOptions = masters ? ["M.E.", "M.Tech", "MCA", "MBA", "M.Sc", "M.Com", "MA", "LLM", "PGDM", "Other"] : ["B.E.", "B.Tech", "B.Sc", "BCA", "B.Com", "BA", "BBA", "BBM", "Other"];
  const usingCustomProgramme = (degree || masters) && record.programme === "Other";
  return (
    <section className="rounded-lg border border-[#e1e5ee] bg-[#fbfcff] p-5">
      <h3 className="mb-4 text-base font-bold text-[#07142f]">{title} details{required ? " *" : ""}</h3>
      <FormGrid>
        <TextField label="School / Institution" value={record.institution} onChange={(value) => onChange({ institution: value })} />
        <TextField label={degree ? "University" : "Board"} value={record.boardOrUniversity} onChange={(value) => onChange({ boardOrUniversity: value })} />
        {degree || masters ? <SelectField label={masters ? "Master's degree" : "Degree"} value={record.programme} onChange={(value) => onChange({ programme: value, customProgramme: value === "Other" ? record.customProgramme : "" })} options={degreeOptions} /> : <TextField label="Stream / Specialisation" value={record.programme} onChange={(value) => onChange({ programme: value })} />}
        {usingCustomProgramme && <TextField label="Enter degree" value={record.customProgramme} onChange={(value) => onChange({ customProgramme: value })} />}
        <TextField label="Year from" type="number" value={record.yearFrom} onChange={(value) => onChange({ yearFrom: value })} />
        <TextField label="Year to" type="number" value={record.yearTo} onChange={(value) => onChange({ yearTo: value })} />
        <TextField label="Percentage / CGPA" value={record.score} onChange={(value) => onChange({ score: value })} />
        <label className="grid gap-2 text-sm font-semibold text-[#343946]">Markscard
          <input type="file" accept="application/pdf,image/*" onChange={(event) => onUpload(event.target.files?.[0])} className="block w-full text-sm text-[#5a5f68] file:mr-3 file:rounded file:border-0 file:bg-[#eaf0ff] file:px-3 file:py-2 file:font-semibold file:text-[#3155ff]" />
          {record.markscardFileName && <span className="flex items-center gap-3 text-xs font-medium"><span className="text-[#3155ff]">Saved: {record.markscardFileName}</span><button type="button" onClick={onRemove} className="font-semibold text-red-600">Remove</button></span>}
        </label>
      </FormGrid>
    </section>
  );
}

function approvalLabel(status?: string) {
  if (status === "Approved") return "Approved by Admin";
  if (status === "Approval Pending by Admin" || status === "Completed" || status === "Profile Completed - Approval Pending") return "Approval Pending by Admin";
  return "Complete your profile for admin approval";
}

function PhotoCropEditor({ source, crop, onCropChange, onApply, onCancel }: { source: string; crop: { x: number; y: number; size: number }; onCropChange: (crop: { x: number; y: number; size: number }) => void; onApply: () => void; onCancel: () => void }) {
  const drag = useRef<{ mode: "move" | "resize"; x: number; y: number; crop: { x: number; y: number; size: number } } | null>(null);
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || !event.currentTarget.parentElement) return;
    const bounds = event.currentTarget.parentElement.getBoundingClientRect();
    if (drag.current.mode === "resize") {
      onCropChange({ ...drag.current.crop, size: Math.max(0.45, Math.min(0.9, drag.current.crop.size + (event.clientX - drag.current.x) / bounds.width)) });
      return;
    }
    const range = Math.max(0.05, (1 - drag.current.crop.size) / 2);
    onCropChange({ ...drag.current.crop, x: Math.max(-1, Math.min(1, drag.current.crop.x + (event.clientX - drag.current.x) / (bounds.width * range))), y: Math.max(-1, Math.min(1, drag.current.crop.y + (event.clientY - drag.current.y) / (bounds.height * range))) });
  }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4" role="dialog" aria-modal="true" aria-label="Adjust profile photo"><div className="w-full max-w-[560px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-[#07142f]">Adjust profile photo</h2><p className="mt-1 text-sm text-[#5f6573]">Drag the grid to move it. Drag its bottom-right handle to resize it.</p></div><div className="shrink-0 text-center"><div className="mx-auto h-16 w-16 overflow-hidden rounded-full border-4 border-white shadow-md"><img src={source} alt="Profile preview" className="h-full w-full object-cover" style={{ objectPosition: `${50 + crop.x * 50}% ${50 + crop.y * 50}%` }} /></div><span className="mt-1 block text-[11px] font-semibold text-[#5f6573]">Preview</span></div></div><div className="relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden rounded-xl bg-slate-100 shadow-inner"><img src={source} alt="Adjust profile photo" draggable={false} className="h-full w-full select-none object-cover" /><div onPointerDown={(event) => { drag.current = { mode: "move", x: event.clientX, y: event.clientY, crop }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} className="absolute cursor-grab touch-none border-2 border-white shadow-[0_0_0_999px_rgba(15,23,42,.42)] active:cursor-grabbing" style={{ width: `${crop.size * 100}%`, height: `${crop.size * 100}%`, left: `${50 + crop.x * ((1 - crop.size) * 50)}%`, top: `${50 + crop.y * ((1 - crop.size) * 50)}%`, transform: "translate(-50%, -50%)" }}><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33%,rgba(255,255,255,.85)_33.5%,transparent_34%,transparent_66%,rgba(255,255,255,.85)_66.5%,transparent_67%),linear-gradient(to_bottom,transparent_33%,rgba(255,255,255,.85)_33.5%,transparent_34%,transparent_66%,rgba(255,255,255,.85)_66.5%,transparent_67%)]" /><button type="button" aria-label="Resize crop grid" onPointerDown={(event) => { event.stopPropagation(); drag.current = { mode: "resize", x: event.clientX, y: event.clientY, crop }; event.currentTarget.setPointerCapture(event.pointerId); }} className="absolute -bottom-3 -right-3 h-7 w-7 cursor-nwse-resize rounded-full border-2 border-white bg-[#3155ff] shadow" /></div></div><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={onCancel} className="rounded-md border border-[#dbe0e9] px-4 py-3 text-sm font-semibold text-[#5a5f68]">Cancel</button><button type="button" onClick={onApply} className="rounded-md bg-[#3155ff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2447f1]">Apply crop</button></div></div></div>;
}