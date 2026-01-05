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

type Task = {
  id: string;
  taskId?: string;
  title: string;
  project: string;
  space: string;
  status: string;
  due?: string;
  statusDetails?: string;
  sprint?: string;
  plannedEstimate?: number | string;
  health?: string;
};

type Person = {
  id: string;
  name: string;
  role: string;
  load: "light" | "balanced" | "heavy";
  spaces: string[];
  databases: string[];
  tasks: Task[];
};

type Connection = {
  workspaceId: string;
  workspaceName: string;
  accessToken: string;
  tasksDbId?: string;
  projectsDbId?: string;
  sprintsDbId?: string;
  shared?: boolean;
};

const NOTION_VERSION = "2022-06-28";
const CONNECTIONS_COOKIE = "notion_connections";
type CookieStore = Awaited<ReturnType<typeof cookies>>;

type NotionPage = { properties?: Record<string, unknown>; id?: string };

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
        // ignore per-page fetch errors
      }
    }),
  );
  return titles;
}

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

export async function GET() {
  const cookieStore = await cookies();
  const connections: Connection[] = readConnections(cookieStore).filter(
    (c) => !!c.tasksDbId,
  );
  const mappings = readMappings(cookieStore);

  // Owner-provided shared token (for guests): set env vars to enable
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
        people: [],
      },
      { status: 400 },
    );
  }

  try {
    const peopleMap = new Map<string, Person>();

    for (const connection of connections) {
      const mapping = mappings[connection.workspaceId] as Record<string, string>;
      const tasksDb = connection.tasksDbId!;
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
        },
      );

      const payload = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          {
            ok: false,
            message:
              payload?.message ??
              `Failed to query Notion for workspace ${connection.workspaceName}`,
            people: [],
          },
          { status: res.status },
        );
      }

      const relationTitles = await buildRelationTitleMap(
        payload.results ?? [],
        connection,
        mapping ?? {},
      );

      for (const page of (payload.results ?? []) as NotionPage[]) {
        const props = (page.properties ?? {}) as Record<string, unknown>;
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
        const relationTitleFor = (propName?: string): string | undefined => {
          if (!propName) return undefined;
          const rel = relationOf(propName);
          const match = rel?.find((r) => r?.id && relationTitles[r.id]);
          return match ? relationTitles[match.id as string] : undefined;
        };

        const title =
          (mapping?.title &&
            (titleFromProperty(props[mapping.title]) ||
              textFromRich(props[mapping.title], "title"))) ||
          titleFromProperty(props["Name"] ?? props["Task"]) ||
          textFromRich(props["Name"], "title") ||
          findAnyTitle(props);
        const project =
          relationTitleFor(mapping?.project ?? "Project") ||
          (mapping?.project &&
            (relationNames(props[mapping.project])[0] ||
              textFromRich(props[mapping.project]))) ||
          relationNames(props["Project"])[0] ||
          textFromRich(props["Project"]) ||
          "Project";
        const space =
          (props["Space"] as { select?: { name?: string }; multi_select?: Array<{ name?: string }> })?.select?.name ??
          (props["Space"] as { select?: { name?: string }; multi_select?: Array<{ name?: string }> })?.multi_select?.[0]?.name ??
          connection.workspaceName;
        const due =
          (mapping?.due && (props[mapping.due] as { date?: { start?: string } })?.date?.start) ||
          (props["Due"] as { date?: { start?: string } })?.date?.start ||
          (props["Deadline"] as { date?: { start?: string } })?.date?.start ||
          undefined;
        const status =
          (mapping?.status && selectName(props[mapping.status])) ||
          selectName(props["Status"]) ||
          (props["Status"] as { status?: { name?: string } })?.status?.name ||
          (props["Status"] as { select?: { name?: string } })?.select?.name ||
          "Unknown";
        const taskId =
          (mapping?.taskId && textFromRich(props[mapping.taskId])) ||
          textFromRich(props["Task ID"]) ||
          textFromRich(props["TaskId"]) ||
          textFromRich(props["ID"]) ||
          page?.id;
        const sprint =
          relationTitleFor(mapping?.sprint ?? "Sprint") ||
          (mapping?.sprint &&
            (relationNames(props[mapping.sprint])[0] ||
              textFromRich(props[mapping.sprint]))) ||
          relationNames(props["Sprint"])[0] ||
          textFromRich(props["Sprint"]) ||
          textFromRich(props["Sprint Name"]) ||
          "No Sprint added";
        const statusDetails =
          (mapping?.statusDetails && textFromRich(props[mapping.statusDetails])) ||
          textFromRich(props["Status Details"]) ||
          textFromRich(props["Details"]) ||
          textFromRich(props["Notes"]);
        const plannedPropValue = findPropCaseInsensitive(props, [
          mapping?.plannedEstimate,
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
          (mapping?.health && valueToText(props[mapping.health])) ||
          valueToText(props["Health"]) ||
          valueToText(props["Risk"]) ||
          valueToText(props["State"]);
        const assignees =
          (props["Assignee"] as { people?: Array<{ id?: string; name?: string }> })?.people ??
          (props["Owner"] as { people?: Array<{ id?: string; name?: string }> })?.people ??
          (props["Owners"] as { people?: Array<{ id?: string; name?: string }> })?.people ??
          [];

        const targets = assignees.length
          ? assignees
          : [{ id: "unassigned", name: "Unassigned" }];

        for (const assignee of targets) {
          const personId = assignee.id ?? "unassigned";
          const personName = assignee.name ?? "Unassigned";
          if (!peopleMap.has(personId)) {
            peopleMap.set(personId, {
              id: personId,
              name: personName,
              role: "Member",
              load: "light",
              spaces: [],
              databases: [tasksDb],
              // mark presence of shared for frontend detection without leaking ids
              ...(connection.shared ? { databases: ["shared"] } : {}),
              tasks: [],
            });
          }
          const person = peopleMap.get(personId)!;
            person.tasks.push({
              id: page.id || taskId || "unknown",
              taskId,
              title: title || "Untitled task",
              project,
              space,
              status,
              due,
              statusDetails,
              sprint,
              plannedEstimate,
              health,
            });
          if (!person.spaces.includes(space)) {
            person.spaces.push(space);
          }
          if (!person.databases.includes(tasksDb)) {
            person.databases.push(tasksDb);
          }
        }
      }
    }

    const people = Array.from(peopleMap.values()).map((p) => {
      const count = p.tasks.length;
      const load: Person["load"] =
        count > 6 ? "heavy" : count > 3 ? "balanced" : "light";
      return { ...p, load };
    });

    return NextResponse.json({ ok: true, people });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unknown error querying Notion",
        people: [],
      },
      { status: 500 },
    );
  }
}
