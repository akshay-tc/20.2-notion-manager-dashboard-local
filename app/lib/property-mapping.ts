export const PROPERTY_MAPPING_COOKIE = "notion_property_mappings";

export type PropertyMapping = {
  title?: string;
  taskId?: string;
  status?: string;
  project?: string;
  due?: string;
  statusDetails?: string;
  sprint?: string;
  plannedEstimate?: string;
  health?: string;
};

type CookieStore = {
  get(name: string): { value?: string } | undefined;
  set?: (
    name: string,
    value: string,
    options?: { httpOnly?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string; maxAge?: number },
  ) => void;
};

export function readMappings(
  cookieStore: CookieStore,
): Record<string, PropertyMapping> {
  try {
    const raw = cookieStore.get(PROPERTY_MAPPING_COOKIE)?.value;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, PropertyMapping>;
    }
  } catch {
    return {};
  }
  return {};
}

export function writeMappingsCookie(
  cookieStore: CookieStore,
  mappings: Record<string, PropertyMapping>,
) {
  if (!cookieStore.set) return;
  cookieStore.set(PROPERTY_MAPPING_COOKIE, JSON.stringify(mappings), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
