export type TaskStatus = "in_progress" | "blocked" | "done" | "queued";

export function mapStatus(raw?: string): TaskStatus {
  const normalized = raw?.toLowerCase() ?? "";
  if (["done", "complete"].includes(normalized)) return "done";
  if (["blocked, stuck"].some((x) => normalized.includes(x))) return "blocked";
  if (["blocked", "stuck"].includes(normalized)) return "blocked";
  if (["in progress", "doing"].includes(normalized)) return "in_progress";
  return "queued";
}

export function titleFromProperty(prop: unknown): string {
  if (
    !prop ||
    typeof prop !== "object" ||
    !("title" in prop) ||
    !Array.isArray((prop as { title: unknown }).title)
  ) {
    return "";
  }
  return ((prop as { title: Array<{ plain_text?: string }> }).title ?? [])
    .map((t) => t.plain_text || "")
    .join("")
    .trim();
}

export function textFromRich(
  prop: unknown,
  key: "title" | "rich_text" = "rich_text",
): string {
  if (
    !prop ||
    typeof prop !== "object" ||
    !(key in (prop as Record<string, unknown>)) ||
    !Array.isArray((prop as { [k: string]: unknown })[key])
  ) {
    return "";
  }
  return ((prop as { [k: string]: Array<{ plain_text?: string }> })[key] ?? [])
    .map((t) => t.plain_text || "")
    .join("")
    .trim();
}

export function selectName(prop: unknown): string {
  if (
    prop &&
    typeof prop === "object" &&
    ("status" in prop || "select" in prop)
  ) {
    const status = (prop as { status?: { name?: string }; select?: { name?: string } })
      .status;
    const select = (prop as { status?: { name?: string }; select?: { name?: string } })
      .select;
    return status?.name || select?.name || "";
  }
  return "";
}

export function relationNames(prop: unknown): string[] {
  if (
    prop &&
    typeof prop === "object" &&
    "relation" in prop &&
    Array.isArray((prop as { relation: Array<{ id?: string; name?: string }> }).relation)
  ) {
    return (
      (prop as { relation: Array<{ id?: string; name?: string }> }).relation.map(
        (r) => r.name || r.id || "",
      ) ?? []
    ).filter(Boolean);
  }
  if (
    prop &&
    typeof prop === "object" &&
    "rollup" in prop &&
    Array.isArray(
      (prop as {
        rollup?: { array?: Array<{ title?: Array<{ plain_text?: string }> }> };
      }).rollup?.array,
    )
  ) {
    const arr =
      (prop as {
        rollup?: { array?: Array<{ title?: Array<{ plain_text?: string }> }> };
      }).rollup?.array ?? [];
    return arr
      .map((item) => textFromRich(item as unknown, "title"))
      .filter(Boolean);
  }
  return [];
}

export function findPropCaseInsensitive(
  props: Record<string, unknown>,
  candidates: (string | undefined)[],
): unknown {
  const normalized: Record<string, string> = {};
  Object.keys(props).forEach((key) => {
    normalized[key.toLowerCase()] = key;
  });
  for (const cand of candidates) {
    if (!cand) continue;
    const hit = normalized[cand.toLowerCase()];
    if (hit && hit in props) return props[hit];
  }
  return undefined;
}

export function numberValue(prop: unknown): number | string | undefined {
  if (typeof prop === "object" && prop && "number" in prop) {
    const n = (prop as { number?: number }).number;
    return typeof n === "number" ? n : undefined;
  }
  if (
    prop &&
    typeof prop === "object" &&
    "rollup" in prop &&
    prop.rollup &&
    typeof (prop as { rollup: unknown }).rollup === "object"
  ) {
    const rollup = (prop as { rollup: { number?: number; array?: Array<unknown> } })
      .rollup;
    if (typeof rollup.number === "number") return rollup.number;
    if (Array.isArray(rollup.array)) {
      const firstNum = rollup.array.find(
        (item) => typeof (item as { number?: number }).number === "number",
      ) as { number?: number } | undefined;
      if (firstNum?.number !== undefined) return firstNum.number;
      const firstTxt = rollup.array.find(
        (item) =>
          Array.isArray((item as { rich_text?: Array<{ plain_text?: string }> }).rich_text),
      ) as { rich_text?: Array<{ plain_text?: string }> } | undefined;
      if (firstTxt?.rich_text) {
        const txt = firstTxt.rich_text.map((t) => t.plain_text || "").join("");
        const num = Number(txt);
        return Number.isFinite(num) ? num : txt || undefined;
      }
    }
  }
  if (
    prop &&
    typeof prop === "object" &&
    "formula" in prop &&
    prop.formula &&
    typeof (prop as { formula: { number?: number; string?: string } }).formula ===
      "object"
  ) {
    const formula = (prop as { formula: { number?: number; string?: string } }).formula;
    if (typeof formula.number === "number") return formula.number;
    if (typeof formula.string === "string" && formula.string.trim()) {
      const num = Number(formula.string);
      return Number.isFinite(num) ? num : formula.string;
    }
  }
  if (
    prop &&
    typeof prop === "object" &&
    "rich_text" in prop &&
    Array.isArray((prop as { rich_text?: Array<{ plain_text?: string }> }).rich_text)
  ) {
    const txt = textFromRich(prop);
    const num = Number(txt);
    return Number.isFinite(num) ? num : txt || undefined;
  }
  return undefined;
}

export function findAnyTitle(props: Record<string, unknown>): string {
  for (const value of Object.values(props)) {
    if (value && typeof value === "object" && "type" in value && value.type === "title") {
      const t = textFromRich(value as unknown, "title");
      if (t) return t;
    }
  }
  return "";
}
