"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Link2, Loader2, Save } from "lucide-react";

type Connection = {
  workspaceId: string;
  workspaceName: string;
  tasksDbId: string;
};

type PropertyMeta = { name: string; type: string };
type Mapping = {
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

const mappingFields: Array<{ key: keyof Mapping; label: string }> = [
  { key: "title", label: "Title" },
  { key: "taskId", label: "Task ID" },
  { key: "status", label: "Status" },
  { key: "project", label: "Project (relation)" },
  { key: "due", label: "Due date" },
  { key: "statusDetails", label: "Status details" },
  { key: "sprint", label: "Sprint (relation)" },
  { key: "plannedEstimate", label: "Planned estimate" },
  { key: "health", label: "Health" },
];

export default function PropertyMappingPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [properties, setProperties] = useState<Record<string, PropertyMeta[]>>({});
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConnections = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/notion/connections");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load connections");
        const list: Connection[] = (data.connections ?? []).filter(
          (c: Connection) => c.tasksDbId,
        );
        setConnections(list);
        // load mapping + props for each
        list.forEach((conn) => {
          loadProperties(conn.workspaceId);
          loadMapping(conn.workspaceId);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load");
      } finally {
        setLoading(false);
      }
    };
    loadConnections();
  }, []);

  const loadProperties = async (workspaceId: string) => {
    try {
      const res = await fetch(`/api/notion/properties?workspaceId=${workspaceId}`);
      const data = await res.json();
      if (res.ok) {
        setProperties((prev) => ({
          ...prev,
          [workspaceId]: data.properties ?? [],
        }));
      }
    } catch {
      // ignore
    }
  };

  const loadMapping = async (workspaceId: string) => {
    try {
      const res = await fetch(
        `/api/notion/property-mapping?workspaceId=${workspaceId}`,
      );
      const data = await res.json();
      if (res.ok) {
        setMappings((prev) => ({ ...prev, [workspaceId]: data.mapping ?? {} }));
      }
    } catch {
      // ignore
    }
  };

  const updateMappingValue = (
    workspaceId: string,
    key: keyof Mapping,
    value: string,
  ) => {
    setMappings((prev) => ({
      ...prev,
      [workspaceId]: { ...(prev[workspaceId] ?? {}), [key]: value },
    }));
  };

  const saveMapping = async (workspaceId: string) => {
    setSaving(workspaceId);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/notion/property-mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          mapping: mappings[workspaceId] ?? {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save mapping");
      setMessage("Mapping saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save mapping");
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(null), 1800);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-xl shadow-slate-900/40 backdrop-blur">
          <div>
            <p className="text-sm text-slate-300">Property mapper</p>
            <h1 className="text-xl font-semibold text-white">
              Map Notion properties to dashboard fields
            </h1>
            <p className="text-xs text-slate-400">
              Managers can override property names per workspace. Choose the correct
              fields for tasks database columns.
            </p>
          </div>
          <a
            href="/connections"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-white/30 hover:bg-white/15"
          >
            <Link2 className="h-4 w-4" />
            Back to connections
          </a>
        </header>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-slate-200">
            No connections yet. Connect a workspace first.
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((conn) => {
              const props = properties[conn.workspaceId] || [];
              const mapping = mappings[conn.workspaceId] || {};
              return (
                <div
                  key={conn.workspaceId}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-slate-900/50 backdrop-blur"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {conn.workspaceName}
                      </p>
                      <p className="text-xs text-slate-400">
                        Tasks DB: {conn.tasksDbId}
                      </p>
                    </div>
                    <button
                      onClick={() => saveMapping(conn.workspaceId)}
                      disabled={saving === conn.workspaceId}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:from-sky-400 hover:to-indigo-400 disabled:opacity-60"
                    >
                      {saving === conn.workspaceId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save mapping
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {mappingFields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <p className="text-xs text-slate-300">{field.label}</p>
                        <select
                          className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white"
                          value={mapping[field.key] ?? ""}
                          onChange={(e) =>
                            updateMappingValue(conn.workspaceId, field.key, e.target.value)
                          }
                        >
                          <option value="">Auto-detect / default</option>
                          {props.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} ({p.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {message ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </main>
    </div>
  );
}
