import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PROPERTY_MAPPING_COOKIE,
  PropertyMapping,
  readMappings,
} from "@/app/lib/property-mapping";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const cookieStore = await cookies();
  const mappings = readMappings(cookieStore);
  if (workspaceId) {
    return NextResponse.json({
      ok: true,
      mapping: mappings[workspaceId] ?? {},
    });
  }
  return NextResponse.json({ ok: true, mappings });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId;
  const mapping = body?.mapping as PropertyMapping | undefined;
  if (!workspaceId || !mapping) {
    return NextResponse.json(
      { ok: false, message: "workspaceId and mapping are required" },
      { status: 400 },
    );
  }

  const sanitized: PropertyMapping = {};
  const allowedKeys: Array<keyof PropertyMapping> = [
    "title",
    "taskId",
    "status",
    "project",
    "due",
    "statusDetails",
    "sprint",
    "plannedEstimate",
    "health",
  ];
  allowedKeys.forEach((key) => {
    const val = mapping[key];
    if (typeof val === "string" && val.trim()) {
      sanitized[key] = val.trim();
    }
  });

  const cookieStore = await cookies();
  const current = readMappings(cookieStore);
  const next = { ...current, [workspaceId]: sanitized };

  const response = NextResponse.json({ ok: true, mapping: sanitized });
  response.cookies.set(PROPERTY_MAPPING_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
