import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const STATE_COOKIE = "notion_oauth_state";
const APP_COOKIE = "notion_app_credentials";
const CONNECTIONS_COOKIE = "notion_connections";

type AppCreds = { clientId: string; clientSecret: string; redirectUri: string };
type Connection = {
  workspaceId: string;
  workspaceName: string;
  accessToken: string;
  botId?: string;
  connectedAt?: number;
  databaseId?: string;
};
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
    // ignore parse errors, fallback later
  }
  return fallback;
}

function readConnections(cookieStore: CookieStore): Connection[] {
  const raw = cookieStore.get(CONNECTIONS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (c) => c.workspaceId && c.workspaceName && c.accessToken,
      ) as Connection[];
    }
  } catch {
    return [];
  }
  return [];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json(
      { ok: false, message: `Notion OAuth error: ${error}` },
      { status: 400 },
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { ok: false, message: "Missing code or state in callback" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.json(
      { ok: false, message: "Invalid OAuth state" },
      { status: 400 },
    );
  }

  const creds = readAppCreds(cookieStore);
  if (!creds) {
    return NextResponse.json(
      { ok: false, message: "Missing Notion app credentials" },
      { status: 500 },
    );
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: creds.redirectUri,
    }),
  });

  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok) {
    return NextResponse.json(
      { ok: false, message: tokenPayload?.error ?? "Failed to exchange code" },
      { status: 400 },
    );
  }

  const connection = {
    workspaceId: tokenPayload.workspace_id,
    workspaceName: tokenPayload.workspace_name,
    accessToken: tokenPayload.access_token,
    botId: tokenPayload.bot_id,
    connectedAt: Date.now(),
  };

  const existing = readConnections(cookieStore);
  const merged = [
    connection,
    ...existing.filter((c) => c.workspaceId !== connection.workspaceId),
  ];

  const response = NextResponse.redirect(new URL("/connections", request.url));
  response.cookies.set(CONNECTIONS_COOKIE, JSON.stringify(merged), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
