"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { professorLastName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

const STORAGE_BUCKET = "course-materials";

// 50 MB matches the storage bucket's file_size_limit. Anything larger is
// rejected before we try to upload.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function safeStoragePath(userId: string, filename: string): string {
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  return `${userId}/${Date.now()}-${sanitized}`;
}

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
  const [panelOpen, setPanelOpen] = useState(false);
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

  // Body-scroll lock + ESC handling. Active when either modal is open.
  useEffect(() => {
    const anyModalOpen = panelOpen || pendingFiles.length > 0;
    if (!anyModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (pendingFiles.length > 0) cancelPending();
        else setPanelOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, pendingFiles.length]);

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

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're signed out. Refresh the page and log back in.");
      setUploading(false);
      return;
    }

    for (const file of filesToUpload) {
      try {
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(
            `File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
          );
        }

        // 1. Upload binary directly to Supabase Storage from the browser.
        // This bypasses the Vercel 4.5 MB request body cap because Vercel
        // is never in the path — the upload goes straight to Supabase.
        const path = safeStoragePath(user.id, file.name);
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });
        if (storageError) {
          throw new Error(storageError.message);
        }

        // 2. Tell the server to extract / chunk / embed from the storage path.
        const res = await fetch("/api/documents/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storage_path: path,
            filename: file.name,
            professor_last_name: lastName,
          }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          // If processing failed, clean up the orphaned Storage file so we
          // don't accumulate junk under the user's quota.
          await supabase.storage.from(STORAGE_BUCKET).remove([path]);
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

  const processingCount = documents.filter(
    (d) => d.status === "processing"
  ).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300"
        title="Upload and manage your course materials"
      >
        <span aria-hidden>📎</span>
        <span>Materials</span>
        {documents.length > 0 && (
          <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-600/30 px-1 text-[10px] font-semibold text-gold-200">
            {documents.length}
          </span>
        )}
        {processingCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-gold-400"
            title={`${processingCount} file${processingCount > 1 ? "s" : ""} indexing…`}
          />
        )}
      </button>

      {panelOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPanelOpen(false);
          }}
        >
          <div
            className="flex min-h-full items-start justify-center px-4 py-6 sm:items-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPanelOpen(false);
            }}
          >
            <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-serif text-xl font-bold tracking-tight">
                    Course materials
                  </div>
                  <p className="mt-1 text-xs text-ink-300">
                    The tutor uses these to ground every answer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="-mr-2 -mt-2 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg text-ink-400 transition hover:bg-surface-elevated hover:text-ink-100"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mb-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-gold-600 px-4 text-sm font-semibold text-ink-900 transition hover:bg-gold-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? "Uploading…" : "+ Upload a file"}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => startUploadFlow(e.target.files)}
              />

              {documents.length === 0 && !uploading && !error && (
                <p className="text-xs text-ink-400">
                  Upload your syllabus, slides, notes, or photos of homework
                  problems (PDF, Word, PowerPoint, Excel, CSV, TXT, JPG, PNG,
                  WebP). Files are tagged with a professor&apos;s last name so
                  they group together.
                </p>
              )}

              {documents.length > 0 && (
                <div className="flex flex-col gap-3">
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
                <p className="mt-3 rounded-lg border border-crimson-700/60 bg-crimson-900/20 px-3 py-2 text-xs text-crimson-200">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {pendingFiles.length > 0 && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[110] overflow-y-auto bg-black/70 backdrop-blur-sm"
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
              <div className="mb-1 flex items-start justify-between gap-3">
                <div className="font-serif text-xl font-bold tracking-tight">
                  Which professor is{" "}
                  {pendingFiles.length === 1 ? "this for?" : "this group for?"}
                </div>
                <button
                  type="button"
                  onClick={cancelPending}
                  className="-mr-2 -mt-2 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg text-ink-400 transition hover:bg-surface-elevated hover:text-ink-100"
                  aria-label="Cancel"
                >
                  ×
                </button>
              </div>
              <p className="mb-4 text-xs text-ink-300">
                Tag{" "}
                {pendingFiles.length === 1
                  ? "this file"
                  : `these ${pendingFiles.length} files`}{" "}
                with a professor&apos;s last name so they group together. Leave
                blank to keep them unsorted.
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
        </div>,
        document.body
      )}
    </>
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
