import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Look up the storage_path before deleting the row so we can also remove
  // the underlying file from Storage. Documents from the legacy /upload
  // route have storage_path = NULL; those don't need cleanup.
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ storage_path: string | null }>();

  // RLS already restricts DELETE to own rows; the explicit user_id check is belt-and-suspenders.
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (doc?.storage_path) {
    await supabase.storage.from("course-materials").remove([doc.storage_path]);
  }

  await supabase.from("analytics_events").insert({
    user_id: user.id,
    event_type: "file_deleted",
    metadata: { document_id: id },
  });

  return NextResponse.json({ ok: true });
}
