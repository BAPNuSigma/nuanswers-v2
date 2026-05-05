import { NextResponse } from "next/server";
import {
  STAFF_COOKIE_NAME,
  STAFF_COOKIE_MAX_AGE,
  staffCookieValue,
  checkStaffPassword,
} from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const submitted = typeof body.password === "string" ? body.password : "";
  if (!submitted) {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }

  if (!checkStaffPassword(submitted)) {
    return NextResponse.json(
      { error: "Wrong password." },
      { status: 401 }
    );
  }

  const value = staffCookieValue();
  if (!value) {
    // STAFF_PASSWORD env var not configured. Refuse to set a stale cookie.
    return NextResponse.json(
      { error: "Staff sign-in is not configured on this deployment." },
      { status: 503 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_COOKIE_MAX_AGE,
  });
  return res;
}
