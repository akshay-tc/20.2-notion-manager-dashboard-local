import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const NOTION_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize";
const STATE_COOKIE = "notion_oauth_state";
const APP_COOKIE = "notion_app_credentials";

type AppCreds = { clientId: string; clientSecret: string; redirectUri: string };
type CookieStore = Awaited<ReturnType<typeof cookies>>;

function readAppCreds(cookieStore: CookieStore): AppCreds | null {
  const raw = cookieStore.get(APP_COOKIE)?.value;
  let fallback: AppCreds | null = null;
  if (
    process.env.NOTION_CLIENT_ID &&
    process.env.NOTION_CLIENT_SECRET &&
    process.env.NOTION_REDIRECT_URI
  ) {
    fallback = {
      clientId: process.env.NOTION_CLIENT_ID,
      clientSecret: process.env.NOTION_CLIENT_SECRET,
      redirectUri: process.env.NOTION_REDIRECT_URI,
    };
  }
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.clientId && parsed.clientSecret && parsed.redirectUri) {
      return {
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        redirectUri: parsed.redirectUri,
      };
    }
  } catch {
    // ignore parse issues and fall back
  }
  return fallback;
}

export async function GET() {
  const cookieStore = await cookies();
  const creds = readAppCreds(cookieStore);
  if (!creds) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Missing Notion client credentials. Save them on the Connections page or set env vars.",
      },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL(NOTION_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("owner", "workspace");
  authorizeUrl.searchParams.set("client_id", creds.clientId);
  authorizeUrl.searchParams.set("redirect_uri", creds.redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
