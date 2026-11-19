"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  removeToken,
  fetchDashboardSummary,
  toggleHabitToday,
  fetchHabitHistory,
  updateTask,
  createHabit,
  deleteHabit,
  DashboardSummary,
  DashboardTaskItem,
  DashboardHabitItem,
} from "@/lib/api";

// ─── Priority pill helper ────────────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-950/80 border-red-700 text-red-300",
  medium: "bg-amber-950/80 border-amber-700 text-amber-300",
  low: "bg-green-950/80 border-green-700 text-green-300",
};
function PriorityPill({ level }: { level: string }) {
  const cls = PRIORITY_STYLES[level?.toLowerCase()] ?? PRIORITY_STYLES.medium;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls} uppercase tracking-wide`}>
      {level}
    </span>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`bg-zinc-900 border ${accent ?? "border-zinc-800"} rounded-2xl p-5 flex flex-col gap-2`}>
      <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium uppercase tracking-wider">
        <span>{icon}</span>
        {label}
      </div>
      <div className="text-3xl font-extrabold text-zinc-100">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

// ─── Inline Task Edit Modal ───────────────────────────────────────────────────
function TaskEditModal({
  task,
  onClose,
  onSave,
}: {
  task: DashboardTaskItem;
  onClose: () => void;
  onSave: (id: number, data: { title: string; due_date?: string; priority_level: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(
    task.due_date ? task.due_date.slice(0, 16) : ""
  );
  const [priority, setPriority] = useState(task.priority_level ?? "medium");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(task.id, {
        title: title.trim(),
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        priority_level: priority,
      });
      onClose();
    } catch {
      alert("Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-zinc-100">Edit Task</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Habit History Modal ──────────────────────────────────────────────────────
function HabitHistoryModal({
  habit,
  onClose,
}: {
  habit: DashboardHabitItem;
  onClose: () => void;
}) {
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHabitHistory(habit.id)
      .then(setDates)
      .catch(() => setDates([]))
      .finally(() => setLoading(false));
  }, [habit.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-100">
            📅 {habit.name} — History
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl">✕</button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500 text-center py-6">Loading…</p>
        ) : dates.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">No completions yet.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {dates.map((d) => (
              <li
                key={d}
                className="flex items-center gap-2 text-sm text-zinc-300 bg-zinc-800/60 rounded-lg px-3 py-2"
              >
                <span className="text-green-400">✓</span>
                {new Date(d).toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [editingTask, setEditingTask] = useState<DashboardTaskItem | null>(null);
  const [historyHabit, setHistoryHabit] = useState<DashboardHabitItem | null>(null);

  // Create habit form
  const [habitName, setHabitName] = useState("");
  const [habitFrequency, setHabitFrequency] = useState("daily");
  const [habitTarget, setHabitTarget] = useState(1);
  const [creatingHabit, setCreatingHabit] = useState(false);

  // Toggling states
  const [togglingHabits, setTogglingHabits] = useState<Set<number>>(new Set());

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardSummary();
      setSummary(data);
    } catch (err: any) {
      if (err?.message?.includes("Session expired") || err?.message?.includes("credentials")) {
        removeToken();
        router.push("/login");
        return;
      }
      setError(err?.message || "Failed to load dashboard. Please refresh.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    loadDashboard();
  }, [router, loadDashboard]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleToggleTask = async (task: DashboardTaskItem) => {
    try {
      await updateTask(task.id, { is_completed: !task.is_completed });
      await loadDashboard();
    } catch {
      alert("Failed to update task");
    }
  };

  const handleSaveTask = async (
    id: number,
    data: { title: string; due_date?: string; priority_level: string }
  ) => {
    await updateTask(id, data);
    await loadDashboard();
  };

  const handleToggleHabit = async (habitId: number) => {
    setTogglingHabits((prev) => new Set(prev).add(habitId));
    try {
      await toggleHabitToday(habitId);
      await loadDashboard();
    } catch {
      alert("Failed to toggle habit");
    } finally {
      setTogglingHabits((prev) => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  };

  const handleDeleteHabit = async (id: number) => {
    if (!confirm("Delete this habit?")) return;
    try {
      await deleteHabit(id);
      await loadDashboard();
    } catch {
      alert("Failed to delete habit");
    }
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;
    setCreatingHabit(true);
    try {
      await createHabit({
        name: habitName.trim(),
        frequency_type: habitFrequency,
        target_count: Number(habitTarget),
      });
      setHabitName("");
      setHabitTarget(1);
      await loadDashboard();
    } catch {
      alert("Failed to create habit");
    } finally {
      setCreatingHabit(false);
    }
  };

  // ── Loading / Error states ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-red-800 rounded-2xl p-8 text-center max-w-sm space-y-4">
          <p className="text-red-400 text-sm">{error ?? "No data available."}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadDashboard}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
            >
              Retry
            </button>
            <button
              onClick={() => {
                removeToken();
                router.push("/login");
              }}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-300 transition"
            >
              Log In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { tasks, habits, goals, weekly_completion_rate } = summary;

  return (
    <>
      {/* ── Modals ── */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
        />
      )}
      {historyHabit && (
        <HabitHistoryModal
          habit={historyHabit}
          onClose={() => setHistoryHabit(null)}
        />
      )}

      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Page Title ── */}
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              {new Date(summary.today).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* ── A. Daily Executive Metrics ── */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 7-Day Completion Rate */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium uppercase tracking-wider">
                <span>📈</span>
                7-Day Completion Rate
              </div>
              <div className="text-3xl font-extrabold text-zinc-100">
                {weekly_completion_rate.toFixed(0)}%
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(weekly_completion_rate, 100)}%` }}
                />
              </div>
            </div>

            {/* Overdue Alert */}
            <StatCard
              icon="⚠️"
              label="Overdue Tasks"
              value={
                <span className={tasks.overdue_count > 0 ? "text-red-400" : "text-green-400"}>
                  {tasks.overdue_count}
                </span>
              }
              sub={tasks.overdue_count > 0 ? "Needs your attention" : "All caught up!"}
              accent={tasks.overdue_count > 0 ? "border-red-800" : "border-zinc-800"}
            />

            {/* Completed Today */}
            <StatCard
              icon="✅"
              label="Completed Today"
              value={`${tasks.completed_today} / ${tasks.total_today}`}
              sub={`${habits.completed_today} of ${habits.total_habits} habits done`}
            />
          </section>

          {/* ── B. Today's Focus Tasks ── */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>🎯</span> Today&apos;s Focus Tasks
            </h2>

            {tasks.items.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">
                No tasks due today. Enjoy your day! 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {tasks.items.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition ${
                      task.is_completed
                        ? "bg-zinc-950/40 border-zinc-800/50 opacity-60"
                        : task.is_overdue
                        ? "bg-red-950/20 border-red-900/50 hover:border-red-700"
                        : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleTask(task)}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                        task.is_completed
                          ? "bg-green-500 border-green-500"
                          : "border-zinc-600 hover:border-indigo-400"
                      }`}
                    >
                      {task.is_completed && (
                        <span className="text-white text-[10px] font-bold">✓</span>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${task.is_completed ? "line-through text-zinc-500" : "text-zinc-200"}`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <PriorityPill level={task.priority_level} />
                        {task.is_overdue && !task.is_completed && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-950/80 border-red-700 text-red-300 uppercase tracking-wide">
                            Overdue
                          </span>
                        )}
                        {task.due_date && (
                          <span className="text-[10px] text-zinc-500">
                            📅 {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Edit button */}
                    <button
                      onClick={() => setEditingTask(task)}
                      className="text-zinc-500 hover:text-indigo-400 p-1 transition flex-shrink-0"
                      title="Edit task"
                    >
                      ✏️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── C. Habits Tracker ── */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>🔁</span> Habits Tracker
              <span className="ml-auto text-xs font-normal text-zinc-500">
                {habits.completed_today}/{habits.total_habits} done today
              </span>
            </h2>

            {/* Habit List */}
            {habits.items.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No habits yet. Create one below!</p>
            ) : (
              <div className="space-y-2">
                {habits.items.map((habit) => {
                  const isToggling = togglingHabits.has(habit.id);
                  return (
                    <div
                      key={habit.id}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border transition ${
                        habit.completed_today
                          ? "bg-green-950/20 border-green-900/50"
                          : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{habit.name}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {habit.target_count}× {habit.frequency_type}
                        </p>
                      </div>

                      {/* Streak badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 flex items-center gap-1">
                          🔥 {habit.current_streak}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 flex items-center gap-1">
                          🏆 {habit.longest_streak}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleToggleHabit(habit.id)}
                          disabled={isToggling}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                            habit.completed_today
                              ? "bg-green-900/50 border-green-700 text-green-300 cursor-default"
                              : "bg-indigo-600/30 hover:bg-indigo-600 border-indigo-500 text-indigo-300 hover:text-white"
                          } disabled:opacity-50`}
                        >
                          {isToggling ? "…" : habit.completed_today ? "Done ✓" : "Mark Done"}
                        </button>
                        <button
                          onClick={() => setHistoryHabit(habit)}
                          className="text-zinc-500 hover:text-blue-400 text-xs transition"
                          title="View history"
                        >
                          📅
                        </button>
                        <button
                          onClick={() => handleDeleteHabit(habit.id)}
                          className="text-zinc-500 hover:text-red-400 text-sm p-0.5 transition"
                          title="Delete habit"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create Habit Form */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-indigo-400 hover:text-indigo-300 font-medium list-none flex items-center gap-1 select-none">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                Add New Habit
              </summary>
              <form onSubmit={handleCreateHabit} className="mt-3 space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Habit name (e.g. Read 20 pages)…"
                  value={habitName}
                  onChange={(e) => setHabitName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={habitFrequency}
                    onChange={(e) => setHabitFrequency(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={habitTarget}
                    onChange={(e) => setHabitTarget(Number(e.target.value))}
                    placeholder="Target"
                    className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingHabit}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition disabled:opacity-50"
                >
                  {creatingHabit ? "Creating…" : "+ Add Habit"}
                </button>
              </form>
            </details>
          </section>

          {/* ── D. Goals Progress ── */}
          {goals.length > 0 && (
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>🎯</span> Goals Progress
              </h2>

              <div className="space-y-4">
                {goals.map((goal) => (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-200 truncate max-w-[70%]">
                        {goal.title}
                      </span>
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {goal.completed_tasks}/{goal.total_tasks} tasks · {goal.progress_percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                        style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="/goals"
                className="inline-block text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition"
              >
                View all goals →
              </a>
            </section>
          )}

        </div>
      </div>
    </>
  );
}
