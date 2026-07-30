"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { getAdminSnapshot, saveAdminSnapshot } from "@/lib/admin-api";

export function CourseBannerPicker({ courseId }: { courseId: string }) {
  const bannerStorageKey = `course-editor-banner-${courseId}-v1`;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("No image selected");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    getAdminSnapshot<{ imageUrl?: string; fileName?: string }>(bannerStorageKey).then((snapshot) => {
      if (!active || !snapshot) return;
      if (snapshot.imageUrl) setImageUrl(snapshot.imageUrl);
      if (snapshot.fileName) setFileName(snapshot.fileName);
      setSaved(true);
    });

    const savedBanner = window.localStorage.getItem(bannerStorageKey);
    if (savedBanner) {
      try {
        const parsed = JSON.parse(savedBanner) as { imageUrl?: string; fileName?: string };
        if (parsed.imageUrl) setImageUrl(parsed.imageUrl);
        if (parsed.fileName) setFileName(parsed.fileName);
        setSaved(true);
      } catch {
        window.localStorage.removeItem(bannerStorageKey);
      }
    }

    return () => {
      active = false;
    };
  }, [bannerStorageKey]);

  function saveBanner(nextImageUrl = imageUrl, nextFileName = fileName) {
    const payload = { imageUrl: nextImageUrl, fileName: nextFileName };
    window.localStorage.setItem(bannerStorageKey, JSON.stringify(payload));
    void saveAdminSnapshot(bannerStorageKey, payload).catch(() => undefined);
    setSaved(true);
  }

  return (
    <div>
      <span className="mb-2 block text-sm font-bold text-slate-700">Course Banner</span>
      <div className="grid h-[130px] place-items-center overflow-hidden rounded-md border border-portal-line bg-[linear-gradient(135deg,#071126,#0f8f64)] text-white">
        {imageUrl ? (
          <img src={imageUrl} alt="Course banner preview" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={32} />
        )}
      </div>
      <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue">
        <Upload size={17} />
        Change Image
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => {
                const result = String(reader.result);
                setImageUrl(result);
                setFileName(file.name);
                setSaved(false);
              };
              reader.readAsDataURL(file);
            }
          }}
        />
      </label>
      <button
        type="button"
        onClick={() => saveBanner()}
        className="ml-3 inline-flex h-10 items-center rounded-md bg-portal-blue px-4 text-sm font-bold text-white"
      >
        {saved ? "Banner Updated" : "Update Banner"}
      </button>
      <p className="mt-2 text-xs font-semibold text-slate-600">{fileName}</p>
      <p className="mt-2 text-xs text-slate-500">Recommended size: 1200x400px, max 2MB.</p>
    </div>
  );
}
