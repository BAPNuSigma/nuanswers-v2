import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const event = await req.json();
    console.log("[analytics]", event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[analytics] bad payload", err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
