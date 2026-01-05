import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  findAnyTitle,
  findPropCaseInsensitive,
  numberValue,
  relationNames,
  selectName,
  textFromRich,
  titleFromProperty,
} from "@/app/lib/notion-props";
import { readMappings } from "@/app/lib/property-mapping";

export const runtime = "nodejs";

type Connection = {
  workspaceId: string;
  workspaceName: string;
  accessToken: string;
  tasksDbId?: string;
  shared?: boolean;
};

type UnifiedTask = {
  pageId: string;
  taskId: string;
  title: string;
  status: string;
  project: string;
  due?: string;
  statusDetails?: string;
  sprint?: string;
  plannedEstimate?: number | string;
  health?: string;
  workspaceId: string;
  workspaceName: string;
  databaseId: string;
};

const NOTION_VERSION = "2022-06-28";
const CONNECTIONS_COOKIE = "notion_connections";
type CookieStore = Awaited<ReturnType<typeof cookies>>;

function valueToText(prop: unknown): string | undefined {
  if (!prop || typeof prop !== "object") return undefined;
  if ("formula" in (prop as Record<string, unknown>)) {
    const formula = (prop as { formula?: { number?: number; string?: string } }).formula;
    if (formula?.string) return formula.string;
    if (typeof formula?.number === "number") return String(formula.number);
  }
  const select = selectName(prop);
  if (select) return select;
  const text =
    textFromRich(prop as unknown, "title") ||
    textFromRich(prop as unknown, "rich_text") ||
    (typeof (prop as { string?: string }).string === "string"
      ? (prop as { string?: string }).string
      : undefined);
  return text || undefined;
}

async function fetchPageTitles(
  ids: string[],
  connection: Connection,
): Promise<Record<string, string>> {
  const titles: Record<string, string> = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
          headers: {
            Authorization: `Bearer ${connection.accessToken}`,
            "Notion-Version": NOTION_VERSION,
          },
        });
        const data = await res.json();
        if (res.ok) {
          titles[id] =
            titleFromProperty(data?.properties?.Name) ||
            titleFromProperty(data?.properties?.Title) ||
            findAnyTitle(data?.properties ?? {}) ||
            data?.id ||
            id;
        }
      } catch {
        // ignore failures per-page
      }
    }),
  );
  return titles;
}

type NotionPage = { id?: string; properties?: Record<string, unknown> };

async function buildRelationTitleMap(
  pages: NotionPage[],
  connection: Connection,
  mapping: Record<string, string>,
): Promise<Record<string, string>> {
  const ids = new Set<string>();
  const collect = (propName?: string) => {
    if (!propName) return;
    pages.forEach((page) => {
      const value = page?.properties?.[propName];
      if (
        value &&
        typeof value === "object" &&
        "relation" in (value as Record<string, unknown>) &&
        Array.isArray((value as { relation?: Array<{ id?: string }> }).relation)
      ) {
        (value as { relation?: Array<{ id?: string }> }).relation?.forEach((r) => {
          if (r?.id) ids.add(r.id);
        });
      }
    });
  };

  collect(mapping.project ?? "Project");
  collect(mapping.sprint ?? "Sprint");

  if (!ids.size) return {};
  return fetchPageTitles(Array.from(ids), connection);
}

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

function mapPageToUnifiedTask(
  page: NotionPage,
  connection: Connection,
  mapping: Record<string, string> = {},
  relationTitles: Record<string, string> = {},
): UnifiedTask {
  const props = (page?.properties ?? {}) as Record<string, unknown>;
  const relationOf = (propName?: string): Array<{ id?: string }> | undefined => {
    if (!propName) return undefined;
    const value = props[propName];
    if (
      value &&
      typeof value === "object" &&
      "relation" in (value as Record<string, unknown>) &&
      Array.isArray((value as { relation?: Array<{ id?: string }> }).relation)
    ) {
      return (value as { relation?: Array<{ id?: string }> }).relation;
    }
    return undefined;
  };
  const titleProp = mapping.title;
  const statusProp = mapping.status;
  const projectProp = mapping.project;
  const dueProp = mapping.due;
  const taskIdProp = mapping.taskId;
  const statusDetailsProp = mapping.statusDetails;
  const sprintProp = mapping.sprint;
  const plannedProp = mapping.plannedEstimate;
  const healthProp = mapping.health;

  const relationTitleFor = (propName?: string): string | undefined => {
    if (!propName) return undefined;
    const rel = relationOf(propName);
    if (Array.isArray(rel)) {
      const match = rel.find((r: { id?: string }) => r?.id && relationTitles[r.id]);
      return match ? relationTitles[match.id as string] : undefined;
    }
    return undefined;
  };

  const title =
    (titleProp && textFromRich(props[titleProp], "title")) ||
    textFromRich(props["Name"], "title") ||
    textFromRich(props["Title"], "title") ||
    textFromRich(props["Task"], "title") ||
    findAnyTitle(props);
  const status =
    (statusProp && selectName(props[statusProp])) ||
    selectName(props["Status"]) ||
    "Unknown";
  const taskId =
    (taskIdProp && textFromRich(props[taskIdProp])) ||
    textFromRich(props["Task ID"]) ||
    textFromRich(props["TaskId"]) ||
    textFromRich(props["ID"]) ||
    page?.id ||
    "";
  const project =
    relationTitleFor(projectProp ?? "Project") ||
    (projectProp &&
      (relationNames(props[projectProp])[0] || textFromRich(props[projectProp]))) ||
    relationNames(props["Project"])[0] ||
    textFromRich(props["Project"]) ||
    textFromRich(props["Project Name"]) ||
    connection.workspaceName;
  const sprint =
    relationTitleFor(sprintProp ?? "Sprint") ||
    (sprintProp &&
      (relationNames(props[sprintProp])[0] || textFromRich(props[sprintProp]))) ||
    relationNames(props["Sprint"])[0] ||
    textFromRich(props["Sprint"]) ||
    "No Sprint added";
  const statusDetails =
    (statusDetailsProp && textFromRich(props[statusDetailsProp])) ||
    textFromRich(props["Status Details"]) ||
    textFromRich(props["Details"]) ||
    textFromRich(props["Notes"]);
  const plannedPropValue = findPropCaseInsensitive(props, [
    plannedProp,
    "Planned Estimates",
    "Planned Estimate",
    "Estimate",
    "Estimation",
    "Points",
    "Story Points",
    "Effort",
    "Hours",
  ]);
  const plannedEstimate =
    numberValue(plannedPropValue) || valueToText(plannedPropValue);
  const health =
    (healthProp && valueToText(props[healthProp])) ||
    valueToText(props["Health"]) ||
    valueToText(props["Risk"]) ||
    valueToText(props["State"]);
  const due =
    (dueProp && (props[dueProp] as { date?: { start?: string } })?.date?.start) ||
    (props["Due"] as { date?: { start?: string } })?.date?.start ||
    (props["Deadline"] as { date?: { start?: string } })?.date?.start ||
    (props["ETA"] as { date?: { start?: string } })?.date?.start ||
    undefined;

  return {
    pageId: page?.id ?? "",
    taskId,
    title: title || "Untitled task",
    status,
    project,
    due,
    statusDetails,
    sprint,
    plannedEstimate,
    health,
    workspaceId: connection.workspaceId,
    workspaceName: connection.workspaceName,
    databaseId: connection.tasksDbId ?? "",
  };
}

async function fetchTasksForConnection(
  connection: Connection,
  mapping: Record<string, string> = {},
): Promise<UnifiedTask[]> {
  const tasksDb = connection.tasksDbId;
  if (!tasksDb) return [];
  const res = await fetch(
    `https://api.notion.com/v1/databases/${tasksDb}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 50,
        sorts: [{ property: "Last edited time", direction: "descending" }],
      }),
      cache: "no-store",
    },
  );

  const payload = await res.json();
  if (!res.ok) {
    const message =
      payload?.message ??
      `Failed to query Notion for workspace ${connection.workspaceName}`;
    throw new Error(message);
  }

  const relationTitles = await buildRelationTitleMap(
    payload.results ?? [],
    connection,
    mapping,
  );

  return (payload.results ?? []).map((page: unknown) =>
    mapPageToUnifiedTask(page as NotionPage, connection, mapping, relationTitles),
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const connections: Connection[] = readConnections(cookieStore).filter(
    (c) => !!c.tasksDbId,
  );
  const mappings = readMappings(cookieStore);

  // Owner-provided shared token (for guests)
  if (
    process.env.NOTION_OWNER_ACCESS_TOKEN &&
    process.env.NOTION_OWNER_DATABASE_ID
  ) {
    connections.unshift({
      workspaceId:
        process.env.NOTION_OWNER_WORKSPACE_ID ?? "shared-workspace",
      workspaceName:
        process.env.NOTION_OWNER_WORKSPACE_NAME ?? "Shared Notion Workspace",
      accessToken: process.env.NOTION_OWNER_ACCESS_TOKEN,
      tasksDbId: process.env.NOTION_OWNER_DATABASE_ID,
      shared: true,
    });
  }

  if (!connections.length) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No connected workspaces with database IDs. Connect and set a tasks database per workspace.",
        tasks: [],
      },
      { status: 400 },
    );
  }

  try {
    const tasksArrays = await Promise.all(
      connections.map((conn) =>
        fetchTasksForConnection(
          conn,
          mappings[conn.workspaceId] as Record<string, string>,
        ),
      ),
    );
    const tasks = tasksArrays.flat();
    return NextResponse.json({ ok: true, tasks });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unknown error querying Notion",
        tasks: [],
      },
      { status: 500 },
    );
  }
}
