"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createAdminBatch, getAdminBatchContext, selectAdminBatch, selectedAdminBatchStorageKey, type AdminBatch } from "@/lib/admin-api";

type BatchContextValue = {
  batches: AdminBatch[];
  selectedBatch: string;
  busy: boolean;
  createBatch: (name: string) => Promise<void>;
  selectBatch: (name: string) => Promise<void>;
};

const BatchContext = createContext<BatchContextValue | null>(null);

export function AdminBatchProvider({ children }: { children: React.ReactNode }) {
  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!window.localStorage.getItem("student-portal-admin-token")) {
      const fallback = window.localStorage.getItem(selectedAdminBatchStorageKey) || "2026 A";
      setBatches([{ name: fallback, student_count: 0 }]);
      setSelectedBatch(fallback);
      setReady(true);
      return () => { active = false; };
    }
    void getAdminBatchContext().then((context) => {
      if (!active) return;
      const selected = context.selected_batch || "2026 A";
      window.localStorage.setItem(selectedAdminBatchStorageKey, selected);
      setBatches(context.batches);
      setSelectedBatch(selected);
    }).catch(() => {
      if (!active) return;
      const fallback = window.localStorage.getItem(selectedAdminBatchStorageKey) || "2026 A";
      window.localStorage.setItem(selectedAdminBatchStorageKey, fallback);
      setBatches([{ name: fallback, student_count: 0 }]);
      setSelectedBatch(fallback);
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  async function selectBatch(name: string) {
    if (!name || name === selectedBatch || busy) return;
    setBusy(true);
    try {
      const result = await selectAdminBatch(name);
      window.localStorage.setItem(selectedAdminBatchStorageKey, result.selected_batch);
      setSelectedBatch(result.selected_batch);
      window.location.reload();
    } finally { setBusy(false); }
  }

  async function createBatch(name: string) {
    const normalized = name.trim().replace(/\s+/g, " ");
    if (!/^\d{4}\s+[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(normalized)) throw new Error("Use a four-digit year and label, for example 2027 A.");
    setBusy(true);
    try {
      const context = await createAdminBatch(normalized);
      window.localStorage.setItem(selectedAdminBatchStorageKey, context.selected_batch);
      setBatches(context.batches);
      setSelectedBatch(context.selected_batch);
      window.location.reload();
    } finally { setBusy(false); }
  }

  const value = { batches, selectedBatch, busy, createBatch, selectBatch };
  if (!ready) return <div className="grid min-h-screen place-items-center bg-portal-bg font-semibold text-slate-600">Loading admin batch...</div>;
  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>;
}

export function useAdminBatch() {
  const context = useContext(BatchContext);
  if (!context) throw new Error("useAdminBatch must be used within AdminBatchProvider");
  return context;
}
