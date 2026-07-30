"use client";

export type ReportRow = Record<string, string | number | boolean | null | undefined>;

function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "report";
}

export function downloadCsv(title: string, rows: ReportRow[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  const csv = [columns.map(quote).join(","), ...rows.map((row) => columns.map((column) => quote(row[column])).join(","))].join("\r\n");
  saveBlob(`${safeName(title)}.csv`, new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
}

export function downloadPdf(title: string, rows: ReportRow[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [title, `Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, "", ...rows.flatMap((row, index) => [
    `Record ${index + 1}`,
    ...columns.map((column) => `${column}: ${String(row[column] ?? "")}`),
    ""
  ])];
  const escape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replace(/[^\x20-\x7E]/g, " ");
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 56)) }, (_, index) => lines.slice(index * 56, (index + 1) * 56));
  const fontId = 3 + pages.length * 2;
  const pageIds = pages.map((_, index) => 3 + index * 2);
  const objects = new Map<number, string>();
  objects.set(1, "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.set(2, `2 0 obj << /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >> endobj`);
  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const content = pageLines.map((line, lineIndex) => `BT /F1 9 Tf 40 ${800 - lineIndex * 13} Td (${escape(line.slice(0, 120))}) Tj ET`).join("\n");
    objects.set(pageId, `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >> endobj`);
    objects.set(contentId, `${contentId} 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`);
  });
  objects.set(fontId, `${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id <= fontId; id++) { offsets.push(pdf.length); pdf += `${objects.get(id)}\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  saveBlob(`${safeName(title)}.pdf`, new Blob([pdf], { type: "application/pdf" }));
}
