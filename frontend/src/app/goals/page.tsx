"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  removeToken,
  fetchGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  fetchTasks,
  createTask,
  updateTask,
  GoalItem,
  TaskItem,
} from "@/lib/api";

// ─── Priority Pill Component ────────────────────────────────────────────────
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

// ─── Days Remaining / Overdue Helper ─────────────────────────────────────────
function TargetDateBadge({ targetDate }: { targetDate?: string | null }) {
  if (!targetDate) return null;

  const target = new Date(targetDate);
  const now = new Date();
  // Strip time for clean day diff
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = targetDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let badgeColor = "bg-zinc-800 text-zinc-300 border-zinc-700";
  let label = `Target: ${target.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  if (diffDays < 0) {
    badgeColor = "bg-red-950/80 border-red-700 text-red-300";
    label = `Overdue by ${Math.abs(diffDays)}d`;
  } else if (diffDays === 0) {
    badgeColor = "bg-amber-950/80 border-amber-700 text-amber-300";
    label = "Due Today!";
  } else if (diffDays <= 7) {
    badgeColor = "bg-amber-950/70 border-amber-700/80 text-amber-300";
    label = `${diffDays}d remaining`;
  } else {
    label = `${diffDays}d left (${target.toLocaleDateString(undefined, { month: "short", day: "numeric" })})`;
  }

  return (
    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border flex items-center gap-1 ${badgeColor}`}>
      <span>📅</span>
      {label}
    </span>
  );
}

// ─── Create / Edit Goal Modal ────────────────────────────────────────────────
interface GoalModalProps {
  goal?: GoalItem | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description?: string;
    start_date?: string;
    target_date?: string;
  }) => Promise<void>;
}

function GoalModal({ goal, onClose, onSave }: GoalModalProps) {
  const isEditing = !!goal;
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [startDate, setStartDate] = useState(goal?.start_date ? goal.start_date.slice(0, 10) : "");
  const [targetDate, setTargetDate] = useState(goal?.target_date ? goal.target_date.slice(0, 10) : "");
  const [dateError, setDateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);

    if (!title.trim()) {
      setDateError("Goal title cannot be empty.");
      return;
    }

    if (startDate && targetDate && targetDate < startDate) {
      setDateError("Target date cannot be earlier than start date.");
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate || undefined,
        target_date: targetDate || undefined,
      });
      onClose();
    } catch (err: any) {
      setDateError(err.message || "Failed to save goal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <span>🎯</span> {isEditing ? "Edit Goal" : "Create New Goal"}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg transition">
            ✕
          </button>
        </div>

        {dateError && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
            {dateError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Goal Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Master Full-Stack RAG Systems"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Key deliverables, purpose, and milestone outcomes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition disabled:opacity-50 shadow-md shadow-indigo-600/20"
            >
              {submitting ? "Saving…" : isEditing ? "Save Changes" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Goals Page ────────────────────────────────────────────────────────
export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded goal cards state (set of goal IDs)
  const [expandedGoals, setExpandedGoals] = useState<Set<number>>(new Set());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);

  // Quick task add per goal
  const [newTaskTitles, setNewTaskTitles] = useState<Record<number, string>>({});
  const [addingTaskForGoal, setAddingTaskForGoal] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedGoals, fetchedTasks] = await Promise.all([
        fetchGoals(),
        fetchTasks(),
      ]);
      setGoals(fetchedGoals);
      setTasks(fetchedTasks);

      // Auto-expand all goals by default for great mobile UX
      setExpandedGoals(new Set(fetchedGoals.map((g) => g.id)));
    } catch (err: any) {
      if (err?.message?.includes("Session expired") || err?.message?.includes("credentials")) {
        removeToken();
        router.push("/login");
        return;
      }
      setError(err?.message || "Failed to load goals. Please refresh.");
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
    loadData();
  }, [router, loadData]);

  const toggleExpand = (goalId: number) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  // ── Goal Handlers ───────────────────────────────────────────────────────────

  const handleCreateGoal = async (data: {
    title: string;
    description?: string;
    start_date?: string;
    target_date?: string;
  }) => {
    await createGoal(data);
    await loadData();
  };

  const handleUpdateGoal = async (data: {
    title: string;
    description?: string;
    start_date?: string;
    target_date?: string;
  }) => {
    if (!editingGoal) return;
    await updateGoal(editingGoal.id, data);
    await loadData();
  };

  const handleDeleteGoal = async (id: number) => {
    if (!confirm("Are you sure you want to delete this goal? Linked tasks will not be deleted, but will become unassigned.")) return;
    try {
      await deleteGoal(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete goal");
    }
  };

  // ── Task Linkage Handlers ───────────────────────────────────────────────────

  const handleToggleTask = async (task: TaskItem) => {
    try {
      await updateTask(task.id, { is_completed: !task.is_completed });
      await loadData(); // Reloads both tasks and recalculated goal progress
    } catch {
      alert("Failed to update task status");
    }
  };

  const handleQuickAddTask = async (goalId: number) => {
    const title = newTaskTitles[goalId]?.trim();
    if (!title) return;

    setAddingTaskForGoal(goalId);
    try {
      await createTask({
        title,
        priority_level: "medium",
        goal_id: goalId,
      });
      setNewTaskTitles((prev) => ({ ...prev, [goalId]: "" }));
      await loadData();
    } catch {
      alert("Failed to add task to goal");
    } finally {
      setAddingTaskForGoal(null);
    }
  };

  const handleUnlinkTask = async (taskId: number) => {
    try {
      await updateTask(taskId, { goal_id: null });
      await loadData();
    } catch {
      alert("Failed to unlink task");
    }
  };

  // ── Loading & Error States ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Loading your goals & milestones…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-red-800 rounded-2xl p-8 text-center max-w-sm space-y-4 shadow-xl">
          <p className="text-red-400 text-sm">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition text-white"
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

  // Summary Metrics
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.progress_percentage >= 100).length;
  const averageProgress = totalGoals > 0
    ? Math.round(goals.reduce((acc, g) => acc + g.progress_percentage, 0) / totalGoals)
    : 0;

  return (
    <>
      {modalOpen && (
        <GoalModal
          goal={editingGoal}
          onClose={() => {
            setModalOpen(false);
            setEditingGoal(null);
          }}
          onSave={editingGoal ? handleUpdateGoal : handleCreateGoal}
        />
      )}

      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                🎯 Goals & Milestones
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Link actionable tasks to strategic outcomes and track automatic progress.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingGoal(null);
                setModalOpen(true);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition duration-150 shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              <span className="text-base leading-none">+</span>
              <span>New Goal</span>
            </button>
          </div>

          {/* ── Metrics Summary ── */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>🎯</span> Total Objectives
              </span>
              <p className="text-3xl font-black text-zinc-100">{totalGoals}</p>
              <p className="text-xs text-zinc-500">Active strategic tracks</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>📊</span> Overall Progress
              </span>
              <p className="text-3xl font-black text-zinc-100">{averageProgress}%</p>
              <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min(averageProgress, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>🏆</span> Completed Goals
              </span>
              <p className="text-3xl font-black text-emerald-400">
                {completedGoals} / {totalGoals}
              </p>
              <p className="text-xs text-zinc-500">
                {completedGoals === totalGoals && totalGoals > 0 ? "All milestones achieved! 🎉" : "In progress"}
              </p>
            </div>
          </section>

          {/* ── Goals List ── */}
          {goals.length === 0 ? (
            <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-4">
              <span className="text-4xl block">🎯</span>
              <h3 className="text-lg font-bold text-zinc-200">No Goals Created Yet</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                Break down your long-term ambitions into measurable outcomes. Add your first goal to link your daily focus tasks!
              </p>
              <button
                onClick={() => {
                  setEditingGoal(null);
                  setModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition shadow-lg shadow-indigo-600/20"
              >
                + Create Your First Goal
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {goals.map((goal) => {
                const isExpanded = expandedGoals.has(goal.id);
                const linkedTasks = tasks.filter((t) => t.goal_id === goal.id);
                const progress = goal.progress_percentage;
                const isComplete = progress >= 100;

                return (
                  <div
                    key={goal.id}
                    className={`bg-zinc-900 border rounded-2xl transition duration-200 overflow-hidden ${
                      isComplete
                        ? "border-emerald-800/60 bg-gradient-to-b from-zinc-900 to-emerald-950/20"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {/* Goal Card Main Content */}
                    <div className="p-5 sm:p-6 space-y-4">
                      {/* Top Row: Title, Dates, Badges & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
                              {goal.title}
                            </h2>
                            {isComplete && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 uppercase">
                                Completed ✓
                              </span>
                            )}
                          </div>
                          {goal.description && (
                            <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                              {goal.description}
                            </p>
                          )}
                        </div>

                        {/* Badges & Actions */}
                        <div className="flex items-center gap-2.5 self-start sm:self-center flex-shrink-0">
                          <TargetDateBadge targetDate={goal.target_date} />
                          <button
                            onClick={() => {
                              setEditingGoal(goal);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition text-sm"
                            title="Edit goal"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition text-sm"
                            title="Delete goal"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar & Counter */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400 font-medium">
                            {goal.completed_tasks} of {goal.total_tasks} linked tasks completed
                          </span>
                          <span className="font-bold text-zinc-200">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-700 ${
                              isComplete
                                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Toggle Task Breakdown Button */}
                      <button
                        onClick={() => toggleExpand(goal.id)}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition pt-1 select-none"
                      >
                        <span className="text-[10px] transform transition-transform duration-200">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                        <span>
                          {isExpanded
                            ? "Hide Task Breakdown"
                            : `Show Task Breakdown (${linkedTasks.length})`}
                        </span>
                      </button>
                    </div>

                    {/* ── Expandable Task Breakdown ── */}
                    {isExpanded && (
                      <div className="bg-zinc-950/70 border-t border-zinc-800/80 p-5 sm:p-6 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                          <span>📋</span> Linked Tasks
                        </h4>

                        {linkedTasks.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic py-2">
                            No tasks linked to this goal yet. Add one below to start driving progress!
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {linkedTasks.map((task) => (
                              <div
                                key={task.id}
                                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                                  task.is_completed
                                    ? "bg-zinc-900/40 border-zinc-800/50 opacity-65"
                                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                                }`}
                              >
                                {/* Checkbox & Title */}
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <button
                                    onClick={() => handleToggleTask(task)}
                                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                                      task.is_completed
                                        ? "bg-green-500 border-green-500 text-white"
                                        : "border-zinc-600 hover:border-indigo-400"
                                    }`}
                                  >
                                    {task.is_completed && (
                                      <span className="text-[10px] font-bold">✓</span>
                                    )}
                                  </button>
                                  <span
                                    className={`text-sm truncate ${
                                      task.is_completed
                                        ? "line-through text-zinc-500"
                                        : "text-zinc-200 font-medium"
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                </div>

                                {/* Priority Pill & Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <PriorityPill level={task.priority_level} />
                                  <button
                                    onClick={() => handleUnlinkTask(task.id)}
                                    title="Unlink from this goal"
                                    className="text-xs text-zinc-500 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition"
                                  >
                                    Unlink
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quick Add Task to this Goal */}
                        <div className="pt-2">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleQuickAddTask(goal.id);
                            }}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              placeholder="Add an actionable task to this goal…"
                              value={newTaskTitles[goal.id] ?? ""}
                              onChange={(e) =>
                                setNewTaskTitles((prev) => ({
                                  ...prev,
                                  [goal.id]: e.target.value,
                                }))
                              }
                              className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="submit"
                              disabled={addingTaskForGoal === goal.id}
                              className="px-4 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500 text-indigo-300 hover:text-white text-xs font-semibold transition disabled:opacity-50 flex-shrink-0"
                            >
                              {addingTaskForGoal === goal.id ? "Adding…" : "+ Add Task"}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
