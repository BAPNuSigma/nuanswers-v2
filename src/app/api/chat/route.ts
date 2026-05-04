import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { TUTORING_SYSTEM_PROMPT } from "@/lib/tutoring-prompt";
import { createClient } from "@/lib/supabase/server";
import { retrieveRelevantChunks, formatRagContext } from "@/lib/rag";
import { profileClassContext, type Profile } from "@/lib/auth";

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

  // Look up the user's profile so we know their current class context.
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "current_course_id, current_course_name, current_professor_name, current_professor_email"
    )
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const classContext = profile ? profileClassContext(profile) : null;

  // Inventory: tell the bot which files the student actually has uploaded
  // OR has access to via classmates' shared uploads.
  let documentsQuery = supabase
    .from("documents")
    .select("filename, file_type, status, user_id, course_id, professor_email")
    .eq("status", "ready");

  if (classContext) {
    documentsQuery = documentsQuery.or(
      `user_id.eq.${user.id},and(course_id.eq.${classContext.course_id},professor_email.eq.${classContext.professor_email})`
    );
  } else {
    documentsQuery = documentsQuery.eq("user_id", user.id);
  }
  const { data: docs } = await documentsQuery.order("filename", {
    ascending: true,
  });

  const readyDocs = docs ?? [];
  const ownDocs = readyDocs.filter((d) => d.user_id === user.id);
  const sharedDocs = readyDocs.filter((d) => d.user_id !== user.id);

  let classLine = "";
  if (classContext) {
    classLine = `\n\nThe student is currently working in class: ${classContext.course_name} (${classContext.course_id}) with Professor ${classContext.professor_name}.`;
  }

  let inventoryContext = classLine;
  if (readyDocs.length === 0) {
    inventoryContext +=
      "\n\nThe student has not uploaded any course materials yet, and no classmates have shared files for this course context. If they reference 'my files,' 'my notes,' or anything similar, gently let them know nothing is uploaded yet and they can upload via the 'Course materials' bar above the chat.";
  } else {
    const ownList = ownDocs.map((d) => `- ${d.filename} (${d.file_type})`).join("\n");
    const sharedList = sharedDocs
      .map((d) => `- ${d.filename} (${d.file_type})`)
      .join("\n");
    inventoryContext += "\n\nFiles the student has access to right now:";
    if (ownList) inventoryContext += `\n\nUploaded by the student:\n${ownList}`;
    if (sharedList)
      inventoryContext += `\n\nShared by classmates in the same course:\n${sharedList}`;
    inventoryContext +=
      "\n\nThis is the COMPLETE list — there are no others. If they reference a file that isn't here, point out exactly which files you actually see and ask if they meant something else.";
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
        lastUserText,
        classContext
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
