import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { TUTORING_SYSTEM_PROMPT } from "@/lib/tutoring-prompt";
import { createClient } from "@/lib/supabase/server";
import { retrieveRelevantChunks, formatRagContext } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequestBody = {
  messages: UIMessage[];
  sessionId?: string | null;
};

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

  const { messages, sessionId: incomingSessionId } =
    (await req.json()) as ChatRequestBody;

  // Resolve session_id — create one on the fly if the client didn't provide.
  let sessionId = incomingSessionId ?? null;
  if (sessionId) {
    // Make sure the session belongs to this user (RLS will already block, but
    // this gives a friendlier error).
    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) sessionId = null;
  }
  if (!sessionId) {
    const { data: newSession, error: newSessionError } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (newSessionError || !newSession) {
      return new Response(
        JSON.stringify({ error: newSessionError?.message ?? "Could not start session." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    sessionId = newSession.id;
  }

  if (!sessionId) {
    // unreachable in practice — both branches above either set or return
    return new Response(
      JSON.stringify({ error: "Could not establish session." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

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

  // Get the latest user message text — we both save it and use it for RAG.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMsg
    ? (lastUserMsg.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => ("text" in p ? p.text : ""))
        .join(" ")
    : "";

  // Persist the user message before streaming starts. (If the stream fails
  // mid-way, we still keep the question on record.)
  if (lastUserText.trim()) {
    await supabase.from("messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: lastUserText,
    });
  }

  // RAG: pull relevant chunks from the user's uploaded materials.
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
      console.warn("[chat] RAG retrieval failed:", err);
    }
  }

  const systemParts = [TUTORING_SYSTEM_PROMPT, inventoryContext];
  if (ragContext) systemParts.push(ragContext);

  const modelMessages = await convertToModelMessages(messages);

  const sessionIdForCallback = sessionId; // narrow type for the closure

  const result = streamText({
    model: openai("gpt-4.1"),
    system: systemParts.join("\n").trim(),
    messages: modelMessages,
    temperature: 0.7,
    onFinish: async ({ text }) => {
      // Persist the assistant's full response after streaming completes.
      if (!text?.trim()) return;
      await supabase.from("messages").insert({
        session_id: sessionIdForCallback,
        user_id: user.id,
        role: "assistant",
        content: text,
      });

      // Bump message_count on the session.
      const { data: counts } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionIdForCallback);
      const total = (counts as unknown as { count?: number })?.count;
      if (typeof total === "number") {
        await supabase
          .from("chat_sessions")
          .update({ message_count: total })
          .eq("id", sessionIdForCallback);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "x-session-id": sessionId,
      ...(ragSources.length
        ? { "x-rag-sources": ragSources.join("|") }
        : {}),
    },
  });
}
