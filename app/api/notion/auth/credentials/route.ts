import { NextResponse } from "next/server";

export const runtime = "nodejs";

const APP_COOKIE = "notion_app_credentials";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const clientId = body?.clientId;
  const clientSecret = body?.clientSecret;
  const redirectUri = body?.redirectUri;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { ok: false, message: "clientId, clientSecret, and redirectUri are required" },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    APP_COOKIE,
    JSON.stringify({ clientId, clientSecret, redirectUri }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  );

  return response;
}

export async function GET() {
  // Do not leak secrets; just indicate presence and return redirectUri for UI convenience.
  return NextResponse.json({
    ok: true,
    hasCredentials:
      !!process.env.NOTION_CLIENT_ID &&
      !!process.env.NOTION_CLIENT_SECRET &&
      !!process.env.NOTION_REDIRECT_URI,
    redirectUri: process.env.NOTION_REDIRECT_URI ?? null,
  });
}
