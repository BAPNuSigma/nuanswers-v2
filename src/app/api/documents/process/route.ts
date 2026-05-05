import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractText,
  getFileExtension,
  isSupportedFileType,
} from "@/lib/extract-text";
import { chunkText } from "@/lib/chunk-text";
import { embedTexts } from "@/lib/embed";

export const runtime = "nodejs";
export const maxDuration = 60;

const STORAGE_BUCKET = "course-materials";

// Server-side processing for files uploaded directly to Supabase Storage
// from the browser. The browser uploads the binary, then POSTs here with
// the storage path so the server can download it, extract text, chunk,
// embed, and save — same pipeline as the legacy /upload route, just
// reading from Storage instead of the multipart body.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: {
    storage_path?: unknown;
    filename?: unknown;
    professor_last_name?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body." },
      { status: 400 }
    );
  }

  const storagePath = typeof body.storage_path === "string" ? body.storage_path : "";
  const filename = typeof body.filename === "string" ? body.filename : "";
  const professorLastName =
    typeof body.professor_last_name === "string"
      ? body.professor_last_name.trim()
      : "";

  if (!storagePath || !filename) {
    return NextResponse.json(
      { error: "Missing storage_path or filename." },
      { status: 400 }
    );
  }

  // The path must live under the user's own folder. RLS enforces this on
  // the storage layer too, but checking here gives a clearer error.
  if (!storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "Storage path must be under your own folder." },
      { status: 403 }
    );
  }

  const ext = getFileExtension(filename);
  if (!isSupportedFileType(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type ".${ext}".` },
      { status: 415 }
    );
  }

  // Look up the user's current class so we can tag this upload with course
  // context (drives cross-classmate sharing via match_document_chunks).
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "current_course_id, current_course_name, current_professor_name, current_professor_email"
    )
    .eq("id", user.id)
    .maybeSingle();

  const displayProfName =
    professorLastName || profile?.current_professor_name || null;

  // Insert the document row first (status: processing) so the user sees
  // the chip appear immediately. We update to ready/failed after embedding.
  const { data: docRow, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      filename,
      file_type: ext,
      status: "processing",
      storage_path: storagePath,
      course_id: profile?.current_course_id ?? null,
      course_name: profile?.current_course_name ?? null,
      professor_name: displayProfName,
      professor_email: profile?.current_professor_email ?? null,
    })
    .select("id")
    .single();

  if (insertError || !docRow) {
    return NextResponse.json(
      { error: insertError?.message ?? "Could not create document record." },
      { status: 500 }
    );
  }

  const documentId = docRow.id;

  try {
    // Download the binary from Storage. RLS guarantees we only get our own.
    const { data: blob, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (downloadError || !blob) {
      throw new Error(
        downloadError?.message ?? "Could not read file from storage."
      );
    }

    const arrayBuf = await blob.arrayBuffer();
    const fileSize = arrayBuf.byteLength;

    // Backfill file_size_bytes once we know it.
    await supabase
      .from("documents")
      .update({ file_size_bytes: fileSize })
      .eq("id", documentId);

    const { text } = await extractText(arrayBuf, filename);

    if (!text.trim()) {
      throw new Error(
        "No readable text found in this file. (Scanned PDFs without OCR aren't supported yet.)"
      );
    }

    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("Could not split file into chunks.");

    const embeddings = await embedTexts(chunks);

    const rows = chunks.map((content, i) => ({
      document_id: documentId,
      user_id: user.id,
      chunk_index: i,
      content,
      embedding: embeddings[i] as unknown as string,
    }));

    const { error: chunksError } = await supabase
      .from("document_chunks")
      .insert(rows);

    if (chunksError) throw new Error(chunksError.message);

    await supabase
      .from("documents")
      .update({ status: "ready", chunk_count: chunks.length })
      .eq("id", documentId);

    await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_type: "file_uploaded",
      metadata: {
        filename,
        file_type: ext,
        size_bytes: fileSize,
        chunk_count: chunks.length,
        via: "storage",
      },
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: documentId,
        filename,
        file_type: ext,
        chunk_count: chunks.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
