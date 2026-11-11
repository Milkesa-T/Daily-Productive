"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  removeToken,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  TaskItem,
  HabitItem,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskCategory, setTaskCategory] = useState("General");

  // New Habit form state
  const [habitName, setHabitName] = useState("");
  const [habitFrequency, setHabitFrequency] = useState("daily");
  const [habitTarget, setHabitTarget] = useState(1);

  // Load data on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setAuthenticated(true);
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedTasks, fetchedHabits] = await Promise.all([
        fetchTasks(),
        fetchHabits(),
      ]);
      setTasks(fetchedTasks);
      setHabits(fetchedHabits);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  // --- TASK ACTIONS ---
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    try {
      const newTask = await createTask({
        title: taskTitle.trim(),
        priority_level: taskPriority,
        due_date: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
        category: taskCategory.trim() || undefined,
      });
      setTasks([newTask, ...tasks]);
      setTaskTitle("");
      setTaskDueDate("");
    } catch (err) {
      alert("Failed to create task");
    }
  };

  const handleToggleTask = async (task: TaskItem) => {
    try {
      const updated = await updateTask(task.id, {
        is_completed: !task.is_completed,
      });
      setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      alert("Failed to update task");
    }
  };

  const handleDeleteTask = async (id: number) => {
    try {
      await deleteTask(id);
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (err) {
      alert("Failed to delete task");
    }
  };

  // --- HABIT ACTIONS ---
  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;

    try {
      const newHabit = await createHabit({
        name: habitName.trim(),
        frequency_type: habitFrequency,
        target_count: Number(habitTarget),
      });
      setHabits([newHabit, ...habits]);
      setHabitName("");
      setHabitTarget(1);
    } catch (err) {
      alert("Failed to create habit");
    }
  };

  const handleIncrementStreak = async (habit: HabitItem) => {
    try {
      const updated = await updateHabit(habit.id, {
        current_streak: habit.current_streak + 1,
      });
      setHabits(habits.map((h) => (h.id === habit.id ? updated : h)));
    } catch (err) {
      alert("Failed to increment streak");
    }
  };

  const handleDeleteHabit = async (id: number) => {
    try {
      await deleteHabit(id);
      setHabits(habits.filter((h) => h.id !== id));
    } catch (err) {
      alert("Failed to delete habit");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Authenticating...
      </div>
    );
  }

  const completedCount = tasks.filter((t) => t.is_completed).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              Daily-Productive Dashboard
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Live FastAPI Backend + Supabase Database + n8n Automations
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-sm font-medium transition"
          >
            Log Out
          </button>
        </header>

        {/* STATS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Total Tasks
            </span>
            <p className="text-2xl font-bold text-white mt-1">{tasks.length}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Completed
            </span>
            <p className="text-2xl font-bold text-green-400 mt-1">
              {completedCount}{" "}
              <span className="text-xs text-zinc-500 font-normal">
                / {tasks.length}
              </span>
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Active Habits
            </span>
            <p className="text-2xl font-bold text-indigo-400 mt-1">
              {habits.length}
            </p>
          </div>
        </div>

        {/* TWO-COLUMN LAYOUT: TASKS & HABITS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: TASKS SECTION */}
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>📋</span> Tasks
              </h2>

              {/* CREATE TASK FORM */}
              <form onSubmit={handleCreateTask} className="space-y-3 mb-6">
                <input
                  type="text"
                  required
                  placeholder="Task title (e.g. Study RAG embeddings)..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
                >
                  + Add Task
                </button>
              </form>

              {/* TASK LIST */}
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">
                    No tasks found. Add your first one above!
                  </p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={task.is_completed}
                          onChange={() => handleToggleTask(task)}
                          className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="truncate">
                          <p
                            className={`text-sm font-medium ${
                              task.is_completed
                                ? "line-through text-zinc-500"
                                : "text-zinc-200"
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                task.priority_level === "high"
                                  ? "bg-red-950 text-red-400 border border-red-800"
                                  : task.priority_level === "medium"
                                    ? "bg-yellow-950 text-yellow-400 border border-yellow-800"
                                    : "bg-green-950 text-green-400 border border-green-800"
                              }`}
                            >
                              {task.priority_level}
                            </span>
                            {task.due_date && (
                              <span className="text-[11px] text-zinc-400">
                                📅{" "}
                                {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-zinc-500 hover:text-red-400 text-sm p-1 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: HABITS SECTION */}
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>🔁</span> Habits & Streaks
              </h2>

              {/* CREATE HABIT FORM */}
              <form onSubmit={handleCreateHabit} className="space-y-3 mb-6">
                <input
                  type="text"
                  required
                  placeholder="Habit name (e.g. Read Documentation)..."
                  value={habitName}
                  onChange={(e) => setHabitName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={habitFrequency}
                    onChange={(e) => setHabitFrequency(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={habitTarget}
                    onChange={(e) => setHabitTarget(Number(e.target.value))}
                    className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition"
                >
                  + Add Habit
                </button>
              </form>

              {/* HABIT LIST */}
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {habits.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-6">
                    No habits yet. Track a new habit above!
                  </p>
                ) : (
                  habits.map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {habit.name}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Target: {habit.target_count}x {habit.frequency_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 flex items-center gap-1">
                          🔥 {habit.current_streak}
                        </span>
                        <button
                          onClick={() => handleIncrementStreak(habit)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500 text-indigo-300 hover:text-white text-xs font-medium transition"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => handleDeleteHabit(habit.id)}
                          className="text-zinc-500 hover:text-red-400 text-sm p-1 transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
