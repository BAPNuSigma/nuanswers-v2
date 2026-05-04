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

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB — Vercel Hobby request body cap

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read upload (expected multipart form-data)." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided. Add it under the 'file' field." },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.` },
      { status: 413 }
    );
  }

  const ext = getFileExtension(file.name);
  if (!isSupportedFileType(ext)) {
    return NextResponse.json(
      {
        error: `Unsupported file type ".${ext}". Try PDF, DOCX, XLSX, CSV, or TXT.`,
      },
      { status: 415 }
    );
  }

  // Insert the document row first (status: processing) so the user sees it appear
  // immediately. We update to 'ready' or 'failed' once embeddings are done.
  const { data: docRow, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      filename: file.name,
      file_type: ext,
      file_size_bytes: file.size,
      status: "processing",
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
    const buffer = await file.arrayBuffer();
    const { text } = await extractText(buffer, file.name);

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
      embedding: embeddings[i] as unknown as string, // pgvector accepts JSON array
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
        filename: file.name,
        file_type: ext,
        size_bytes: file.size,
        chunk_count: chunks.length,
      },
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: documentId,
        filename: file.name,
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
