import { NextResponse } from "next/server";
import { STAFF_COOKIE_NAME } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: STAFF_COOKIE_NAME, path: "/" });
  return res;
}
