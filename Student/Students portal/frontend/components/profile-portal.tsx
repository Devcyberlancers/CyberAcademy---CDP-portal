"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Camera, ChevronLeft, Edit3, FileText, IdCard, Upload, UserRound } from "lucide-react";
import { DashboardShell, type StudentSection } from "@/components/dashboard-shell";
import { Card } from "@/components/ui";
import {
  defaultStudentAccount,
  fetchStudentProfile,
  persistStudentProfile,
  readStudentAccount,
  type StudentAccount
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
      });
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

  useEffect(() => {
    setDraft(student);
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

  async function updateProfilePhoto(file: File | undefined) {
    if (!file) return;
    setSaved(false);
    setSaveError("");
    try {
      const photoDataUrl = await prepareProfilePhoto(file);
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

  async function saveProfile() {
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

            <h1 className="mt-6 text-2xl font-bold text-[#07142f]">{draft.fullName || "Student Profile"}</h1>
            <p className="mt-2 text-lg font-semibold text-[#43b92f]">{draft.status || "Pending"}</p>
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
              <InfoLine label="Registration Number" value={draft.registrationNumber} />
              <InfoLine label="Email" value={draft.email} />
              <InfoLine label="Phone" value={draft.phone} />
              <InfoLine label="Gender" value={draft.gender} />
              <InfoLine label="Date of Birth" value={draft.dateOfBirth} />
              <InfoLine label="Tag" value={draft.tag} />
            </div>
          </Card>

          <div className="pt-5">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryPill icon={<ChevronLeft size={18} />} label="Batch" value={draft.batch} />
              <SummaryPill icon={<IdCard size={18} />} label="Department" value={draft.department} />
              <SummaryPill icon={<IdCard size={18} />} label="Course" value={draft.course} />
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
                  <TextField label="Full Name" value={draft.fullName} onChange={(value) => setField("fullName", value)} />
                  <TextField label="Cyberlancers ID" value={draft.cyberlancersId} onChange={(value) => setField("cyberlancersId", value)} />
                  <TextField label="Registration Number" value={draft.registrationNumber} onChange={(value) => setField("registrationNumber", value)} />
                  <TextField label="Email" value={draft.email} onChange={(value) => setField("email", value)} />
                  <TextField label="Phone" value={draft.phone} onChange={(value) => setField("phone", value)} />
                  <TextField label="Gender" value={draft.gender} onChange={(value) => setField("gender", value)} />
                  <TextField label="Date of Birth" type="date" value={draft.dateOfBirth} onChange={(value) => setField("dateOfBirth", value)} />
                  <TextField label="Batch" value={draft.batch} onChange={(value) => setField("batch", value)} />
                  <TextField label="Course" value={draft.course} onChange={(value) => setField("course", value)} />
                  <TextField label="College" value={draft.college} onChange={(value) => setField("college", value)} />
                  <TextField label="Department" value={draft.department} onChange={(value) => setField("department", value)} />
                  <TextField label="Status" value={draft.status} onChange={(value) => setField("status", value)} />
                </FormGrid>
              )}

              {activeTab === "Academic Information" && (
                <FormGrid>
                  <TextField label="Batch" value={draft.batch} onChange={(value) => setField("batch", value)} />
                  <TextField label="Department" value={draft.department} onChange={(value) => setField("department", value)} />
                  <TextField label="Course" value={draft.course} onChange={(value) => setField("course", value)} />
                  <TextField label="College" value={draft.college} onChange={(value) => setField("college", value)} />
                  <TextField label="Registration Number" value={draft.registrationNumber} onChange={(value) => setField("registrationNumber", value)} />
                </FormGrid>
              )}

              {activeTab === "Additional Information" && (
                <FormGrid>
                  <TextField label="Full Name" value={draft.fullName} onChange={(value) => setField("fullName", value)} />
                  <TextField label="Cyberlancers ID" value={draft.cyberlancersId} onChange={(value) => setField("cyberlancersId", value)} />
                  <TextField label="Phone" value={draft.phone} onChange={(value) => setField("phone", value)} />
                  <TextField label="Gender" value={draft.gender} onChange={(value) => setField("gender", value)} />
                  <TextField label="Date of Birth" type="date" value={draft.dateOfBirth} onChange={(value) => setField("dateOfBirth", value)} />
                  <TextField label="Tag" value={draft.tag} onChange={(value) => setField("tag", value)} />
                </FormGrid>
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
                      {draft.resumeDataUrl && (
                        <a href={draft.resumeDataUrl} download={draft.resumeFileName || "resume"} className="text-sm font-semibold text-[#3155ff]">
                          Download
                        </a>
                      )}
                    </div>
                  )}

                  <FormGrid>
                    <TextField label="Resume Link" value={draft.resumeUrl} onChange={(value) => setField("resumeUrl", value)} />
                  </FormGrid>
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
                  <TextField label="Email" value={draft.email} onChange={(value) => setField("email", value)} />
                  <TextField label="Status" value={draft.status} onChange={(value) => setField("status", value)} />
                </FormGrid>
              )}

              <div className="mt-8 flex items-center gap-3">
                <button type="button" onClick={saveProfile} disabled={isSaving} className="rounded-md bg-[#3155ff] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2447f1] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
                {saved && <span className="text-sm font-semibold text-[#43b92f]">Saved</span>}
                {saveError && <span className="text-sm font-semibold text-[#c03434]">{saveError}</span>}
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

const maxProfilePhotoDimension = 512;
const maxProfilePhotoDataUrlLength = 55_000;

async function prepareProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(1, maxProfilePhotoDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not process this photo.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
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
