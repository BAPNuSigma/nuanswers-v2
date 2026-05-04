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

  // Inventory: tell the bot which files the student actually has uploaded,
  // so it can answer questions like "compare my two files" intelligently
  // even when RAG doesn't return any chunks.
  const { data: docs } = await supabase
    .from("documents")
    .select("filename, file_type, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const readyDocs = (docs ?? []).filter((d) => d.status === "ready");
  let inventoryContext = "";
  if (readyDocs.length === 0) {
    inventoryContext =
      "\n\nThe student has not uploaded any course materials yet. If they reference 'my files,' 'my notes,' or anything similar, gently let them know nothing is uploaded yet and they can upload via the 'Course materials' bar above the chat.";
  } else {
    const list = readyDocs
      .map((d) => `- ${d.filename} (${d.file_type})`)
      .join("\n");
    inventoryContext = `\n\nThe student has uploaded these files (this is the COMPLETE list — there are no others):\n${list}\n\nIf they reference 'my two files' or a file that isn't in this list, point out exactly which files you actually see and ask if they meant to upload more.`;
  }

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
  if (lastUserText.trim() && readyDocs.length > 0) {
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

  const systemParts = [TUTORING_SYSTEM_PROMPT, inventoryContext];
  if (ragContext) systemParts.push(ragContext);

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai("gpt-4.1"),
    system: systemParts.join("\n").trim(),
    messages: modelMessages,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse({
    headers: ragSources.length
      ? { "x-rag-sources": ragSources.join("|") }
      : undefined,
  });
}
