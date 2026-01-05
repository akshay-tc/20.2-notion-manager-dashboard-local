import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CONNECTIONS_COOKIE = "notion_connections";
const NOTION_VERSION = "2022-06-28";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type Connection = {
  workspaceId: string;
  accessToken: string;
  tasksDbId?: string;
};

function readConnections(cookieStore: CookieStore): Connection[] {
  const raw = cookieStore.get(CONNECTIONS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (c) => c.workspaceId && c.accessToken && c.tasksDbId,
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
  const connections = readConnections(cookieStore);
  const connection = connections.find((c) => c.workspaceId === workspaceId);
  if (!connection?.tasksDbId) {
    return NextResponse.json(
      { ok: false, message: "Workspace not found or missing tasks database" },
      { status: 404 },
    );
  }

  const res = await fetch(
    `https://api.notion.com/v1/databases/${connection.tasksDbId}`,
    {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
    },
  );
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, message: data?.message || "Failed to fetch properties" },
      { status: res.status },
    );
  }

  const properties =
    Object.entries(data?.properties ?? {}).map(([name, meta]) => ({
      name,
      type: (meta as { type?: string })?.type ?? "unknown",
    })) ?? [];

  return NextResponse.json({ ok: true, properties });
}
