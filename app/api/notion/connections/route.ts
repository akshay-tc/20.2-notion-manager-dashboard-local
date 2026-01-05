import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CONNECTIONS_COOKIE = "notion_connections";

type Connection = {
  workspaceId: string;
  workspaceName: string;
  accessToken: string;
  tasksDbId?: string;
  projectsDbId?: string;
  sprintsDbId?: string;
  connectedAt?: number;
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

export async function GET() {
  const cookieStore = await cookies();
  const connections = readConnections(cookieStore).map((c) => ({
    workspaceId: c.workspaceId,
    workspaceName: c.workspaceName,
    tasksDbId: c.tasksDbId ?? "",
    projectsDbId: c.projectsDbId ?? "",
    sprintsDbId: c.sprintsDbId ?? "",
    connectedAt: c.connectedAt ?? null,
  }));
  return NextResponse.json({ ok: true, connections });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId;
  const tasksDbId = body?.tasksDbId;
  const projectsDbId = body?.projectsDbId;
  const sprintsDbId = body?.sprintsDbId;

  if (
    !workspaceId ||
    typeof tasksDbId !== "string" ||
    typeof projectsDbId !== "string" ||
    typeof sprintsDbId !== "string"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "workspaceId, tasksDbId, projectsDbId, sprintsDbId are required",
      },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const updated = readConnections(cookieStore).map((c) =>
    c.workspaceId === workspaceId
      ? { ...c, tasksDbId, projectsDbId, sprintsDbId }
      : c,
  );

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CONNECTIONS_COOKIE, JSON.stringify(updated), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, message: "workspaceId is required" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const remaining = readConnections(cookieStore).filter(
    (c) => c.workspaceId !== workspaceId,
  );
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    CONNECTIONS_COOKIE,
    JSON.stringify(remaining),
    remaining.length
      ? {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        }
      : { maxAge: 0, path: "/" },
  );
  return response;
}

async function fetchWorkspaceAndDbs(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };

  let workspaceId = "workspace";
  let workspaceName = "Notion Workspace";

  try {
    const me = await fetch("https://api.notion.com/v1/users/me", {
      headers,
    });
    const mePayload = await me.json();
    if (me.ok) {
      workspaceId = mePayload.id ?? workspaceId;
      workspaceName =
        mePayload.name ??
        mePayload.bot?.workspace_name ??
        mePayload.bot?.owner?.workspace_name ??
        workspaceName;
    }
  } catch {
    // ignore, fallback defaults
  }

  const search = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers,
    body: JSON.stringify({
      filter: { property: "object", value: "database" },
      page_size: 100,
    }),
  });
  const searchPayload = await search.json();
  if (!search.ok) {
    throw new Error(searchPayload?.message || "Failed to list databases");
  }
  const databases: Array<{ id: string; title: string }> =
    (searchPayload.results ?? [])
      .map((db: { id?: string; title?: Array<{ plain_text?: string }> }) => ({
        id: db.id ?? "",
        title:
          db.title?.map((t) => t.plain_text || "").join("").trim() || "Untitled",
      }))
      .filter((d: { id: string; title: string }) => d.id) || [];

  const pickDb = (patterns: RegExp[]) =>
    databases.find((db) => patterns.some((p) => p.test(db.title.toLowerCase())))?.id;

  const tasksDbId = pickDb([/task/, /todo/]) ?? "";
  const projectsDbId = pickDb([/project/]) ?? "";
  const sprintsDbId = pickDb([/sprint/, /iteration/, /cycle/]) ?? "";

  return { workspaceId, workspaceName, tasksDbId, projectsDbId, sprintsDbId };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = body?.accessToken;

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "accessToken is required" },
      { status: 400 },
    );
  }

  try {
    const { workspaceId, workspaceName, tasksDbId, projectsDbId, sprintsDbId } =
      await fetchWorkspaceAndDbs(accessToken);

    if (!tasksDbId || !projectsDbId || !sprintsDbId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Could not auto-detect Tasks, Projects, or Sprints databases. Please name them accordingly (Tasks/Projects/Sprints) and try again, or use OAuth.",
        },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const current = readConnections(cookieStore).filter(
      (c) => c.workspaceId !== workspaceId,
    );
    const updated: Connection[] = [
      {
        workspaceId,
        workspaceName,
        accessToken,
        tasksDbId,
        projectsDbId,
        sprintsDbId,
        connectedAt: Date.now(),
      },
      ...current,
    ];

    const response = NextResponse.json({
      ok: true,
      workspaceName,
      detected: { tasksDbId, projectsDbId, sprintsDbId },
    });
    response.cookies.set(CONNECTIONS_COOKIE, JSON.stringify(updated), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to save integration token",
      },
      { status: 500 },
    );
  }
}
