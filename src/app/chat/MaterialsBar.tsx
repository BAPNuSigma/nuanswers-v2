"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { professorLastName } from "@/lib/auth";

export type DocumentRow = {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number | null;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  professor_name: string | null;
};

const ACCEPT =
  ".pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.webp";

export function MaterialsBar({
  initialDocuments,
  defaultProfessorLastName,
}: {
  initialDocuments: DocumentRow[];
  defaultProfessorLastName: string;
}) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pending files waiting for the professor-name prompt.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [profInput, setProfInput] = useState("");

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

  // When the modal is open, lock body scroll + ESC-to-close.
  useEffect(() => {
    if (pendingFiles.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelPending();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles.length]);

  function startUploadFlow(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setPendingFiles(Array.from(files));
    setProfInput(defaultProfessorLastName);
  }

  function cancelPending() {
    setPendingFiles([]);
    setProfInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmPending(e: FormEvent) {
    e.preventDefault();
    const lastName = profInput.trim();
    const filesToUpload = pendingFiles;
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(true);

    for (const file of filesToUpload) {
      try {
        const form = new FormData();
        form.append("file", file);
        if (lastName) form.append("professor_last_name", lastName);
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

  // Group documents by normalized professor last name. Old documents that
  // were uploaded before the per-upload prompt existed will have full names
  // like "Dr. Jane Smith" — we collapse those to "Smith" for the group key
  // so old + new files end up together.
  const groups = groupByProfessor(documents);
  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Unsorted") return 1;
    if (b === "Unsorted") return -1;
    return a.localeCompare(b);
  });

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
            onChange={(e) => startUploadFlow(e.target.files)}
          />
        </div>

        {documents.length === 0 && !uploading && !error && (
          <p className="text-xs text-ink-400">
            Upload your syllabus, slides, notes, or photos of homework problems
            (PDF, Word, PowerPoint, Excel, CSV, TXT, JPG, PNG, WebP). The tutor
            uses them to ground every answer in your class.
          </p>
        )}

        {documents.length > 0 && (
          <div className="flex flex-col gap-2">
            {groupKeys.map((key) => (
              <ProfessorGroup
                key={key}
                title={key}
                docs={groups[key]}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-crimson-700/60 bg-crimson-900/20 px-3 py-2 text-xs text-crimson-200">
            {error}
          </p>
        )}
      </div>

      {pendingFiles.length > 0 && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelPending();
          }}
        >
          <div
            className="flex min-h-full items-center justify-center px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelPending();
            }}
          >
            <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
              <div className="mb-1 font-serif text-xl font-bold tracking-tight">
                Which professor is{" "}
                {pendingFiles.length === 1 ? "this for?" : "this group for?"}
              </div>
              <p className="mb-4 text-xs text-ink-300">
                Tag {pendingFiles.length === 1 ? "this file" : `these ${pendingFiles.length} files`}{" "}
                with a professor&apos;s last name so they group together. You
                can leave it blank to keep them unsorted.
              </p>

              <ul className="mb-4 flex flex-col gap-1 text-xs text-ink-200">
                {pendingFiles.map((f) => (
                  <li key={f.name} className="truncate">
                    • {f.name}
                  </li>
                ))}
              </ul>

              <form onSubmit={confirmPending} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-ink-300">
                    Professor&apos;s last name
                  </span>
                  <input
                    autoFocus
                    value={profInput}
                    onChange={(e) => setProfInput(e.target.value)}
                    placeholder="Smith"
                    className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30"
                  />
                </label>

                <div className="mt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelPending}
                    className="rounded-full border border-border px-4 py-2 text-sm text-ink-200 hover:border-ink-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-crimson-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-600"
                  >
                    Upload
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfessorGroup({
  title,
  docs,
  onDelete,
}: {
  title: string;
  docs: DocumentRow[];
  onDelete: (id: string) => void;
}) {
  const ready = docs.filter((d) => d.status === "ready");
  const processing = docs.filter((d) => d.status === "processing");
  const failed = docs.filter((d) => d.status === "failed");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-medium uppercase tracking-widest text-ink-400">
        {title === "Unsorted" ? "Unsorted" : `Prof. ${title}`}
        <span className="ml-2 text-ink-500">{docs.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {ready.map((d) => (
          <DocChip key={d.id} doc={d} onDelete={onDelete} />
        ))}
        {processing.map((d) => (
          <DocChip key={d.id} doc={d} onDelete={onDelete} />
        ))}
        {failed.map((d) => (
          <DocChip key={d.id} doc={d} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function groupByProfessor(
  docs: DocumentRow[]
): Record<string, DocumentRow[]> {
  const out: Record<string, DocumentRow[]> = {};
  for (const d of docs) {
    const key = professorLastName(d.professor_name) || "Unsorted";
    if (!out[key]) out[key] = [];
    out[key].push(d);
  }
  return out;
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
    jpg: "bg-purple-700/30 text-purple-200",
    jpeg: "bg-purple-700/30 text-purple-200",
    png: "bg-purple-700/30 text-purple-200",
    webp: "bg-purple-700/30 text-purple-200",
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
