"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";

type Connection = {
  workspaceId: string;
  workspaceName: string;
  tasksDbId: string;
  projectsDbId: string;
  sprintsDbId: string;
  connectedAt: number | null;
};

type DbOption = { id: string; title: string };

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");

  const [internalToken, setInternalToken] = useState("");

  const [dbOptions, setDbOptions] = useState<Record<string, DbOption[]>>({});

  const loadConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notion/connections");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load connections");
      setConnections(data.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const saveCredentials = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/notion/auth/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, redirectUri }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save credentials");
      setSuccess("OAuth credentials saved. Now connect a workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save credentials");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 1800);
    }
  };

  const loadDbOptions = useCallback(async (workspaceId: string) => {
    if (dbOptions[workspaceId]) return;
    try {
      const res = await fetch(`/api/notion/databases?workspaceId=${workspaceId}`);
      const data = await res.json();
      if (res.ok) {
        setDbOptions((prev) => ({ ...prev, [workspaceId]: data.databases || [] }));
      }
    } catch {
      // ignore
    }
  }, [dbOptions]);

  useEffect(() => {
    if (!connections.length) return;
    connections.forEach((conn) => {
      loadDbOptions(conn.workspaceId);
    });
  }, [connections, loadDbOptions]);

  const saveDbSelection = async (
    workspaceId: string,
    tasksDbId: string,
    projectsDbId: string,
    sprintsDbId: string,
  ) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/notion/connections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, tasksDbId, projectsDbId, sprintsDbId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save databases");
      setSuccess("Saved database selection");
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save databases");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 1500);
    }
  };

  const saveIntegrationConnection = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/notion/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: internalToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save integration token");
      setSuccess("Integration token connection saved");
      setInternalToken("");
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save token");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 1500);
    }
  };

  const handleDelete = async (workspaceId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/notion/connections?workspaceId=${workspaceId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to remove connection");
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove connection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-lg shadow-slate-900/40 backdrop-blur">
          <p className="text-sm text-slate-300">Notion connections</p>
          <h1 className="text-xl font-semibold text-white">
            Choose how to connect workspaces
          </h1>
          <p className="text-xs text-slate-400">
            Option 1: OAuth with your Notion app keys. Option 2: Integration token from a
            workspace owner.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/50 backdrop-blur">
          <div className="mb-3 text-sm font-semibold text-white">
            Option 1 · Connect via OAuth
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Client ID"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-sky-400/70"
            />
            <input
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Client Secret"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-sky-400/70"
            />
            <input
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder="Redirect URI (e.g. http://localhost:3000/api/notion/auth/callback)"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-sky-400/70"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white"
              onClick={saveCredentials}
              disabled={saving}
            >
              Save credentials
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:from-sky-400 hover:to-indigo-400"
              onClick={() => (window.location.href = "/api/notion/auth/start")}
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
              OAuth connect workspace
            </button>
            <p className="text-xs text-slate-400">
              Stored per user in an HttpOnly cookie. Every user can bring their own
              Notion app keys.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/50 backdrop-blur">
          <div className="mb-3 text-sm font-semibold text-white">
            Option 2 · Connect with integration token
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={internalToken}
              onChange={(e) => setInternalToken(e.target.value)}
              placeholder="Integration token (secret)"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none ring-0 focus:border-sky-400/70"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:text-white"
              onClick={saveIntegrationConnection}
              disabled={saving || !internalToken}
            >
              Save integration key
            </button>
            <p className="text-xs text-slate-400">
              We will auto-detect the workspace and required task/project/sprint databases
              from the integration token.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/50 backdrop-blur">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/10" />
              ))}
            </div>
          ) : connections.length ? (
            <div className="space-y-4">
              {connections.map((c) => (
                <div
                  key={c.workspaceId}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{c.workspaceName}</p>
                    <p className="text-xs text-slate-300 break-all">{c.workspaceId}</p>
                    {c.connectedAt ? (
                      <p className="text-[11px] text-slate-400">
                        Connected {new Date(c.connectedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex flex-wrap gap-2">
                      {(["tasksDbId", "projectsDbId", "sprintsDbId"] as const).map((key) => {
                        const currentValue =
                          key === "tasksDbId"
                            ? c.tasksDbId
                            : key === "projectsDbId"
                              ? c.projectsDbId
                              : c.sprintsDbId;
                        const options = dbOptions[c.workspaceId] || [];
                        const mergedOptions =
                          currentValue && !options.find((db) => db.id === currentValue)
                            ? [
                                {
                                  id: currentValue,
                                  title: `Selected (ID: ${currentValue})`,
                                },
                                ...options,
                              ]
                            : options;

                        return (
                        <select
                          key={key}
                          className="w-48 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white"
                          value={currentValue || ""}
                          onFocus={() => loadDbOptions(c.workspaceId)}
                          onChange={(e) => {
                            const updated: Connection = {
                              ...c,
                              ...(key === "tasksDbId"
                                ? { tasksDbId: e.target.value }
                                : key === "projectsDbId"
                                  ? { projectsDbId: e.target.value }
                                  : { sprintsDbId: e.target.value }),
                            } as Connection;
                            saveDbSelection(
                              updated.workspaceId,
                              updated.tasksDbId,
                              updated.projectsDbId,
                              updated.sprintsDbId,
                            );
                          }}
                        >
                          <option value="">
                            {key === "tasksDbId"
                              ? "Select Tasks DB"
                              : key === "projectsDbId"
                                ? "Select Projects DB"
                                : "Select Sprints DB"}
                          </option>
                          {mergedOptions.map((db) => (
                            <option key={db.id} value={db.id}>
                              {db.title}
                            </option>
                          ))}
                        </select>
                        );
                      })}
                      <Link2 className="h-4 w-4 text-sky-300" />
                    </div>
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-rose-400/60 hover:text-rose-200"
                      onClick={() => handleDelete(c.workspaceId)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-slate-200">
              No connections yet. Connect via OAuth above or save an integration token and
              database IDs (tasks, projects, sprints).
            </div>
          )}

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              {success}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
