import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { secret } = (await request.json().catch(() => ({}))) as {
    secret?: string;
  };

  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "Secret is required" },
      { status: 400 },
    );
  }

  const managerSecret = process.env.MANAGER_SECRET;
  if (!managerSecret) {
    return NextResponse.json(
      { ok: false, message: "Manager secret not configured" },
      { status: 500 },
    );
  }

  if (secret !== managerSecret) {
    return NextResponse.json(
      { ok: false, message: "Invalid manager secret" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
