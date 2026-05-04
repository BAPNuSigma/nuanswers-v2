/**
 * Generate embedding vectors via OpenAI's text-embedding-3-small model.
 *
 * Why text-embedding-3-small:
 *   - 1536 dimensions (matches our pgvector column)
 *   - $0.02 per 1M tokens — basically free at our scale
 *   - 5x cheaper and similar quality to text-embedding-ada-002
 */

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMENSIONS = 1536;
const BATCH_SIZE = 100; // OpenAI accepts up to 2048 inputs per call; we keep it conservative.

type OpenAIEmbeddingResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
};

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const all: number[][] = new Array(texts.length);
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: batch,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI embedding request failed: ${res.status} ${errText}`);
    }

    const json = (await res.json()) as OpenAIEmbeddingResponse;
    for (const item of json.data) {
      if (item.embedding.length !== EMBED_DIMENSIONS) {
        throw new Error(
          `Unexpected embedding dimensions: got ${item.embedding.length}, expected ${EMBED_DIMENSIONS}`
        );
      }
      all[start + item.index] = item.embedding;
    }
  }

  return all;
}

export async function embedSingle(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}

export const EMBEDDING_DIMENSIONS = EMBED_DIMENSIONS;
