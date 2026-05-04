import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isFduEmail, isValidCourseId } from "@/lib/auth";

export const runtime = "nodejs";

type ClassPayload = {
  course_id?: string | null;
  course_name?: string | null;
  professor_name?: string | null;
  professor_email?: string | null;
};

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: ClassPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Allow clearing the class by passing nulls / empty strings.
  const clearing =
    !body.course_id &&
    !body.course_name &&
    !body.professor_name &&
    !body.professor_email;

  if (!clearing) {
    if (!body.course_id || !isValidCourseId(body.course_id)) {
      return NextResponse.json(
        { error: "Invalid course ID. Format: DEPT_####_## (e.g., ACCT_3220_01)." },
        { status: 400 }
      );
    }
    if (!body.course_name?.trim()) {
      return NextResponse.json(
        { error: "Course name is required (e.g., 'Intermediate Financial Accounting II')." },
        { status: 400 }
      );
    }
    if (!body.professor_name?.trim()) {
      return NextResponse.json(
        { error: "Professor name is required." },
        { status: 400 }
      );
    }
    if (!body.professor_email || !isFduEmail(body.professor_email)) {
      return NextResponse.json(
        { error: "Professor email must be a valid FDU email (@fdu.edu or @student.fdu.edu)." },
        { status: 400 }
      );
    }
  }

  const update = clearing
    ? {
        current_course_id: null,
        current_course_name: null,
        current_professor_name: null,
        current_professor_email: null,
      }
    : {
        current_course_id: body.course_id!.trim(),
        current_course_name: body.course_name!.trim(),
        current_professor_name: body.professor_name!.trim(),
        current_professor_email: body.professor_email!.trim().toLowerCase(),
      };

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("analytics_events").insert({
    user_id: user.id,
    event_type: clearing ? "class_cleared" : "class_set",
    metadata: clearing
      ? null
      : {
          course_id: update.current_course_id,
          professor_email: update.current_professor_email,
        },
  });

  return NextResponse.json({ ok: true });
}
