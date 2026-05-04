"use client";

import { useEffect, useRef, useState } from "react";

export type DocumentRow = {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number | null;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
};

const ACCEPT = ".pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt";

export function MaterialsBar({
  initialDocuments,
}: {
  initialDocuments: DocumentRow[];
}) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshDocuments() {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) return;
      const json = (await res.json()) as { documents: DocumentRow[] };
      setDocuments(json.documents ?? []);
    } catch {
      // ignore — silent refresh
    }
  }

  // Poll while any document is in 'processing' state.
  useEffect(() => {
    const hasPending = documents.some((d) => d.status === "processing");
    if (!hasPending) return;
    const t = setInterval(refreshDocuments, 1500);
    return () => clearInterval(t);
  }, [documents]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error ?? `Upload failed (${res.status})`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setError(`${file.name}: ${msg}`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refreshDocuments();
  }

  async function handleDelete(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
    } catch {
      // ignore — refresh will reconcile
    }
    await refreshDocuments();
  }

  const ready = documents.filter((d) => d.status === "ready");
  const processing = documents.filter((d) => d.status === "processing");
  const failed = documents.filter((d) => d.status === "failed");

  return (
    <div className="flex-none border-b border-border/60 bg-surface/40">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-widest text-ink-400">
            Course materials
            {documents.length > 0 && (
              <span className="ml-2 text-ink-300">{documents.length}</span>
            )}
          </span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gold-600 px-3 text-xs font-semibold text-ink-900 transition hover:bg-gold-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "+ Upload"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {documents.length === 0 && !uploading && !error && (
          <p className="text-xs text-ink-400">
            Upload your syllabus, slides, or notes (PDF, Word, PowerPoint, Excel,
            CSV, TXT). The tutor uses them to ground every answer in your class.
          </p>
        )}

        {documents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ready.map((d) => (
              <DocChip key={d.id} doc={d} onDelete={handleDelete} />
            ))}
            {processing.map((d) => (
              <DocChip key={d.id} doc={d} onDelete={handleDelete} />
            ))}
            {failed.map((d) => (
              <DocChip key={d.id} doc={d} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-crimson-700/60 bg-crimson-900/20 px-3 py-2 text-xs text-crimson-200">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function DocChip({
  doc,
  onDelete,
}: {
  doc: DocumentRow;
  onDelete: (id: string) => void;
}) {
  const isProcessing = doc.status === "processing";
  const isFailed = doc.status === "failed";

  return (
    <div
      className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
        isFailed
          ? "border-crimson-700/60 bg-crimson-900/20 text-crimson-200"
          : isProcessing
            ? "border-gold-700/40 bg-gold-900/15 text-gold-200"
            : "border-border bg-surface text-ink-100"
      }`}
      title={
        isFailed
          ? `Failed: ${doc.error_message ?? "unknown error"}`
          : isProcessing
            ? "Reading and indexing this file…"
            : `${doc.chunk_count} chunks indexed`
      }
    >
      <FileTypeBadge ext={doc.file_type} />
      <span className="max-w-[200px] truncate font-medium">{doc.filename}</span>
      {isProcessing && <Spinner />}
      <button
        type="button"
        onClick={() => onDelete(doc.id)}
        className="ml-1 rounded-full px-1 text-ink-400 transition hover:text-crimson-300"
        title="Remove"
        aria-label={`Remove ${doc.filename}`}
      >
        ×
      </button>
    </div>
  );
}

function FileTypeBadge({ ext }: { ext: string }) {
  const colorMap: Record<string, string> = {
    pdf: "bg-crimson-700/30 text-crimson-200",
    docx: "bg-blue-700/30 text-blue-200",
    pptx: "bg-orange-700/30 text-orange-200",
    xlsx: "bg-green-700/30 text-green-200",
    xls: "bg-green-700/30 text-green-200",
    csv: "bg-green-700/30 text-green-200",
    txt: "bg-ink-600 text-ink-200",
  };
  const cls = colorMap[ext.toLowerCase()] ?? "bg-ink-600 text-ink-200";
  return (
    <span
      className={`inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] uppercase ${cls}`}
    >
      {ext}
    </span>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
  );
}
