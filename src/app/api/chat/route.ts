import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { TUTORING_SYSTEM_PROMPT } from "@/lib/tutoring-prompt";
import { createClient } from "@/lib/supabase/server";
import { retrieveRelevantChunks, formatRagContext } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "OPENAI_API_KEY is not set. Add it to .env.local (local) or Vercel environment variables (deployed).",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Not signed in." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  // RAG: pull relevant chunks from the user's uploaded materials based on
  // their latest message. If they have no uploads, this is a no-op.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMsg
    ? (lastUserMsg.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join(" ")
    : "";

  let ragContext: string | null = null;
  let ragSources: string[] = [];
  if (lastUserText.trim()) {
    try {
      const chunks = await retrieveRelevantChunks(
        supabase,
        user.id,
        lastUserText
      );
      ragContext = formatRagContext(chunks);
      ragSources = Array.from(new Set(chunks.map((c) => c.filename)));
    } catch (err) {
      // Don't fail the whole chat if RAG breaks — just log and continue without context.
      console.warn("[chat] RAG retrieval failed:", err);
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai("gpt-4.1"),
    system: ragContext
      ? `${TUTORING_SYSTEM_PROMPT}\n\n${ragContext}`
      : TUTORING_SYSTEM_PROMPT,
    messages: modelMessages,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse({
    headers: ragSources.length
      ? { "x-rag-sources": ragSources.join("|") }
      : undefined,
  });
}
