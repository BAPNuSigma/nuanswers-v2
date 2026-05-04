import { embedSingle } from "@/lib/embed";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassContext } from "@/lib/auth";

export type RagChunk = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  similarity: number;
  is_own: boolean;
  is_shared: boolean;
};

const MIN_SIMILARITY = 0.25; // discard chunks that are clearly off-topic
const TOP_K = 5;

export async function retrieveRelevantChunks(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  classContext: ClassContext | null,
  topK: number = TOP_K
): Promise<RagChunk[]> {
  if (!query.trim()) return [];

  const queryEmbedding = await embedSingle(query);

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_course_id: classContext?.course_id ?? null,
    match_professor_email: classContext?.professor_email ?? null,
    match_count: topK,
  });

  if (error) {
    console.warn("[rag] match_document_chunks error:", error.message);
    return [];
  }

  const rows = (data ?? []) as RagChunk[];
  return rows.filter((r) => r.similarity >= MIN_SIMILARITY);
}

/**
 * Format retrieved chunks into a system-message-friendly block.
 * The tutor sees this as authoritative context for the student's question.
 * Chunks owned by the current student vs. shared from classmates are
 * labelled differently so the tutor can attribute appropriately.
 */
export function formatRagContext(chunks: RagChunk[]): string | null {
  if (!chunks.length) return null;

  const blocks = chunks.map((c, i) => {
    const origin = c.is_shared
      ? "shared by a classmate in your course"
      : "your upload";
    return `--- Source ${i + 1}: ${c.filename} (${origin}) ---\n${c.content.trim()}`;
  });

  return [
    "The student has uploaded course materials, and may also have access to materials shared by classmates in the same course (same professor + same section). The following excerpts are relevant to their current question. When answering, ground your guidance in these excerpts and (briefly) reference the filename when you draw from one. If the materials don't cover the question, follow rule 8 from your behavior rules.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}
