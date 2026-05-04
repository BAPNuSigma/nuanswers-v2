import { embedSingle } from "@/lib/embed";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RagChunk = {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  similarity: number;
};

const MIN_SIMILARITY = 0.25; // discard chunks that are clearly off-topic
const TOP_K = 5;

export async function retrieveRelevantChunks(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  topK: number = TOP_K
): Promise<RagChunk[]> {
  if (!query.trim()) return [];

  const queryEmbedding = await embedSingle(query);

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
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
 */
export function formatRagContext(chunks: RagChunk[]): string | null {
  if (!chunks.length) return null;

  const blocks = chunks.map((c, i) => {
    return `--- Source ${i + 1}: ${c.filename} ---\n${c.content.trim()}`;
  });

  return [
    "The student has uploaded course materials. The following excerpts are relevant to their current question. When answering, ground your guidance in these excerpts and (briefly) reference the filename when you draw from one. If the materials don't cover the question, follow rule 8 from your behavior rules.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}
