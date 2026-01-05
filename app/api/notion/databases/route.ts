import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CONNECTIONS_COOKIE = "notion_connections";
const NOTION_VERSION = "2022-06-28";

type Connection = {
  workspaceId: string;
  workspaceName: string;
  accessToken: string;
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function readConnections(cookieStore: CookieStore): Connection[] {
  const raw = cookieStore.get(CONNECTIONS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (c) => c.workspaceId && c.workspaceName && c.accessToken,
      );
    }
  } catch {
    return [];
  }
  return [];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, message: "workspaceId is required" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const connection = readConnections(cookieStore).find(
    (c) => c.workspaceId === workspaceId,
  );
  if (!connection) {
    return NextResponse.json(
      { ok: false, message: "Workspace not found in your connections" },
      { status: 404 },
    );
  }

  try {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "database" },
        page_size: 100,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: payload?.message ?? "Failed to list databases" },
        { status: res.status },
      );
    }

    const databases =
      (payload.results ?? [])
        .map((db: { id?: string; title?: Array<{ plain_text?: string }> }) => ({
          id: db.id,
          title:
            db.title?.map((t) => t.plain_text || "").join("").trim() || "Untitled",
        }))
        .filter((d: { id?: string; title: string }) => d.id) || [];

    return NextResponse.json({ ok: true, databases });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error listing databases",
      },
      { status: 500 },
    );
  }
}
