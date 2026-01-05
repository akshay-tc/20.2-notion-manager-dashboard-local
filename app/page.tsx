"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock3,
  FolderKanban,
  Link2,
  LogOut,
  RefreshCcw,
  Settings,
  Users,
} from "lucide-react";

type TaskStatus = "in_progress" | "blocked" | "done" | "queued";

type Task = {
  id: string;
  taskId?: string;
  title: string;
  project: string;
  space: string;
  status: TaskStatus;
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

const statusStyles: Record<
  TaskStatus,
  { label: string; dot: string; text: string }
> = {
  in_progress: {
    label: "In progress",
    dot: "bg-sky-400",
    text: "text-sky-200",
  },
  blocked: {
    label: "Blocked",
    dot: "bg-rose-500",
    text: "text-rose-200",
  },
  done: {
    label: "Done",
    dot: "bg-emerald-400",
    text: "text-emerald-200",
  },
  queued: {
    label: "Queued",
    dot: "bg-amber-400",
    text: "text-amber-200",
  },
};

export default function Home() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usingShared, setUsingShared] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/notion/people");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load Notion data");
        const list: Person[] = data.people ?? [];
        setPeople(list);
        setSelectedId(list[0]?.id ?? null);
        setConnected(list.length > 0);
        const sharedFlag =
          Array.isArray(data.people) &&
          data.people.some(
            (p: { databases?: string[]; role?: string }) =>
              Array.isArray(p.databases) && p.databases.includes("shared"),
          );
        setUsingShared(sharedFlag);
      } catch {
        setPeople([]);
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const selectedPerson = useMemo(
    () => people.find((p) => p.id === selectedId) ?? null,
    [people, selectedId],
  );

  const aggregates = useMemo(() => {
    const allTasks = people.flatMap((p) => p.tasks);
    console.log(allTasks)
    const spaces = new Set<string>();
    const databases = new Set<string>();
    people.forEach((p) => {
      p.spaces.forEach((s) => spaces.add(s));
      p.databases.forEach((d) => databases.add(d));
    });
    const blocked = allTasks.filter((t) => t.status === "blocked").length;
    const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
    const done = allTasks.filter((t) => t.status === "done").length;
    return {
      totalPeople: people.length,
      totalTasks: allTasks.length,
      spaces: spaces.size,
      databases: databases.size,
      blocked,
      inProgress,
      done,
    };
  }, [people]);

  const handleDisconnect = () => {
    setConnected(false);
  };

  const fadeIn = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <motion.header
          className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-xl shadow-slate-900/40 backdrop-blur"
          initial={fadeIn.initial}
          animate={fadeIn.animate}
        >
          <div>
            <p className="text-sm text-slate-300">Workload cockpit</p>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Merged Notion view across every workspace
              </h1>
              <motion.span
                className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: 0.1 } }}
              >
                Live
              </motion.span>
            </div>
            <p className="text-xs text-slate-400">
              Connect via OAuth or integration key, merge projects/tasks/sprints, and
              drill into any teammate instantly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-slate-900/30 transition hover:border-white/30 hover:bg-white/15"
              href="/connections"
            >
              <Link2 className="h-4 w-4" />
              Manage connections
            </a>
            {connected ? (
              <button
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:from-sky-400 hover:to-indigo-400"
                onClick={handleDisconnect}
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            ) : (
              <a
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:from-sky-400 hover:to-indigo-400"
                href="/connections"
              >
                <RefreshCcw className="h-4 w-4" />
                Connect Notion
              </a>
            )}
          </div>
        </motion.header>

        <motion.section
          className="grid gap-4 md:grid-cols-3"
          initial={fadeIn.initial}
          animate={fadeIn.animate}
        >
          {[
            {
              title: "People in view",
              value: aggregates.totalPeople,
              sub: `${aggregates.spaces} workspaces • ${aggregates.databases} databases`,
            },
            {
              title: "Active workload",
              value: aggregates.totalTasks,
              sub: `${aggregates.inProgress} in progress • ${aggregates.blocked} blocked`,
            },
            {
              title: "Shipped",
              value: aggregates.done,
              sub: "Completed across all spaces",
            },
          ].map((card, idx) => (
            <motion.div
              key={card.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-900/40 backdrop-blur"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 + 0.1 } }}
            >
              <p className="text-sm text-slate-300">{card.title}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
              <p className="text-xs text-slate-300">{card.sub}</p>
            </motion.div>
          ))}
        </motion.section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
          <motion.div
            className="space-y-4"
            initial={fadeIn.initial}
            animate={fadeIn.animate}
          >
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-900/50 backdrop-blur">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-300" />
                  <span>Team lineup</span>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold ${
                    connected ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {connected ? "Connected" : "Connect to load"}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                <AnimatePresence>
                  {people.map((person) => (
                    <motion.button
                      key={person.id}
                      onClick={() => setSelectedId(person.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                        selectedId === person.id
                          ? "border-sky-400/60 bg-sky-400/10 text-white shadow-lg shadow-sky-900/30"
                          : "border-white/5 bg-white/5 text-slate-200 hover:border-white/20"
                      }`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.995 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-semibold text-white">
                          {person.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{person.name}</p>
                          <p className="text-xs text-slate-300">{person.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            person.load === "heavy"
                              ? "bg-rose-400"
                              : person.load === "balanced"
                                ? "bg-amber-300"
                                : "bg-emerald-400"
                          }`}
                        />
                        <span
                          className={
                            person.load === "heavy"
                              ? "text-rose-200"
                              : person.load === "balanced"
                                ? "text-amber-200"
                                : "text-emerald-200"
                          }
                        >
                          {person.load === "heavy"
                            ? "At capacity"
                            : person.load === "balanced"
                              ? "Healthy"
                              : "Light"}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
                {!people.length && !loading ? (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-slate-300">
                    No members yet. Connect a workspace to pull people and tasks.
                  </div>
                ) : null}
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/10" />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-900/50 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-sky-300" />
                  Connected spaces overview
                </div>
                <a
                  href="/connections"
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition hover:border-white/20 hover:bg-white/15"
                >
                  <Link2 className="h-3 w-3" />
                  Configure
                </a>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-200">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-slate-400">Workspaces</p>
                  <p className="text-lg font-semibold text-white">{aggregates.spaces}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-slate-400">Databases</p>
                  <p className="text-lg font-semibold text-white">{aggregates.databases}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-slate-400">Blocked</p>
                  <p className="text-lg font-semibold text-rose-200">{aggregates.blocked}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-slate-400">In progress</p>
                  <p className="text-lg font-semibold text-sky-200">{aggregates.inProgress}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                {usingShared
                  ? "Using owner-provided integration token for guest access."
                  : "Each member can connect multiple workspaces with OAuth or integration token."}
              </p>
            </div>
          </motion.div>

          <motion.section
            className="space-y-4"
            initial={fadeIn.initial}
            animate={fadeIn.animate}
          >
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-slate-900/50 backdrop-blur">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/10" />
                    ))}
                  </div>
                </div>
              ) : selectedPerson ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedPerson.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-300">Member</p>
                        <div className="flex items-center gap-2 text-lg font-semibold text-white">
                          {selectedPerson.name}
                          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs font-medium text-slate-200">
                            {selectedPerson.role}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <Circle className="h-3 w-3 text-amber-300" />
                          Multi-workspace read-only view
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Clock3 className="h-4 w-4 text-sky-300" />
                        {selectedPerson.tasks.length} tasks in pipeline
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
                      <div className="space-y-2">
                        {selectedPerson.tasks.map((task, idx) => {
                          const style = statusStyles[task.status];
                          return (
                            <motion.div
                              key={task.id}
                              className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-md shadow-slate-900/40"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.03 } }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-3">
                                  <span
                                    className={`mt-1 h-2.5 w-2.5 rounded-full ${style.dot}`}
                                  />
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-white">
                                      {task.title}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1">
                                        {task.project}
                                      </span>
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                                        {task.space}
                                      </span>
                                      {task.due ? (
                                        <span className="rounded-full bg-amber-400/10 px-2 py-1 text-amber-200">
                                          Due {task.due}
                                        </span>
                                      ) : null}
                                      {task.taskId ? (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                                          ID: {task.taskId}
                                        </span>
                                      ) : null}
                                      {task.sprint ? (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                                          Sprint: {task.sprint}
                                        </span>
                                      ) : null}
                                    {typeof task.plannedEstimate !== "undefined" ? (
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                                        Est: {task.plannedEstimate}
                                      </span>
                                      ) : (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                                          Est: Not added
                                        </span>
                                      )}
                                    </div>
                                    {task.statusDetails ? (
                                      <p className="text-[11px] text-slate-300">
                                        {task.statusDetails}
                                      </p>
                                    ) : null}
                                    {task.health ? (
                                      <p className="text-[11px] text-emerald-200">
                                        Health: {task.health}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <span className={`text-xs ${style.text}`}>{style.label}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                        {selectedPerson.tasks.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300">
                            No tasks found for this member. Check your Notion database
                            filters.
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow-inner shadow-slate-900/50">
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <FolderKanban className="h-4 w-4 text-sky-300" />
                            Workspaces & databases
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedPerson.spaces.map((space) => (
                              <span
                                key={space}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                              >
                                {space}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-slate-300">
                            {selectedPerson.databases.map((db) => (
                              <div
                                key={db}
                                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                                <span className="text-slate-200">{db}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-md shadow-slate-900/40">
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                              Health check
                            </div>
                            <button className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10">
                              <Settings className="h-3.5 w-3.5" />
                              Filters
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                              <p className="text-[11px] text-slate-400">Blocked</p>
                              <p className="text-lg font-semibold text-rose-200">
                                {selectedPerson.tasks.filter((t) => t.status === "blocked").length}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                              <p className="text-[11px] text-slate-400">In progress</p>
                              <p className="text-lg font-semibold text-sky-200">
                                {selectedPerson.tasks.filter((t) => t.status === "in_progress").length}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                              <p className="text-[11px] text-slate-400">Queued</p>
                              <p className="text-lg font-semibold text-amber-200">
                                {selectedPerson.tasks.filter((t) => t.status === "queued").length}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                              <p className="text-[11px] text-slate-400">Done</p>
                              <p className="text-lg font-semibold text-emerald-200">
                                {selectedPerson.tasks.filter((t) => t.status === "done").length}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 text-[11px] text-slate-400">
                            Snapshot merges every connected workspace so managers see one
                            view of workload across spaces.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-start gap-3 text-sm text-slate-200">
                  <p className="text-base font-semibold text-white">No members loaded</p>
                  <p>
                    Connect Notion, select workspaces/databases, and we&apos;ll render live
                    tasks from your databases.
                  </p>
                </div>
              )}
            </div>
          </motion.section>
        </section>
      </main>
    </div>
  );
}
