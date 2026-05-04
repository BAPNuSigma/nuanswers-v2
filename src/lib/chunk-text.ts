/**
 * Naive token estimator: ~4 characters per token for English text.
 * Good enough for chunking decisions; we don't need exact counts.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const TARGET_CHUNK_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 75;
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * 4;
const CHUNK_OVERLAP_CHARS = CHUNK_OVERLAP_TOKENS * 4;

/**
 * Split a long string into overlapping chunks suitable for embedding.
 *
 * Strategy:
 *   1. Split on paragraph boundaries first (preserves meaning).
 *   2. Greedily pack paragraphs into chunks until we hit the size cap.
 *   3. If a single paragraph is too big, hard-split it on sentence boundaries,
 *      then on character count as a last resort.
 *   4. Each chunk overlaps the previous one by ~75 tokens for context.
 */
export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Tiny documents: return as a single chunk so we always have something to embed.
  if (estimateTokens(trimmed) <= TARGET_CHUNK_TOKENS) {
    return [trimmed];
  }

  const paragraphs = splitParagraphs(trimmed);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (!para) continue;

    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= TARGET_CHUNK_CHARS) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      // Carry the tail forward as overlap context.
      current = tail(current, CHUNK_OVERLAP_CHARS) + "\n\n" + para;
    } else {
      // Single paragraph bigger than the target — hard split it.
      const subChunks = hardSplit(para, TARGET_CHUNK_CHARS, CHUNK_OVERLAP_CHARS);
      chunks.push(...subChunks.slice(0, -1));
      current = subChunks[subChunks.length - 1] ?? "";
    }
  }

  if (current.trim()) chunks.push(current);

  return chunks.map((c) => c.trim()).filter(Boolean);
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim());
}

function tail(text: string, chars: number): string {
  if (text.length <= chars) return text;
  return text.slice(text.length - chars);
}

function hardSplit(text: string, size: number, overlap: number): string[] {
  // Try sentence boundaries first.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > size) {
      // A single sentence is bigger than our target — split by characters.
      if (current) chunks.push(current);
      for (let i = 0; i < sentence.length; i += size - overlap) {
        chunks.push(sentence.slice(i, i + size));
      }
      current = "";
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= size) {
      current = candidate;
    } else {
      chunks.push(current);
      current = tail(current, overlap) + " " + sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
