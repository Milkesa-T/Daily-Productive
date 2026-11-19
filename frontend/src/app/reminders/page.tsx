"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  removeToken,
  fetchReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  ReminderItem,
} from "@/lib/api";

// ─── Recurrence Labels & Badges ─────────────────────────────────────────────
const RECURRENCE_LABELS: Record<string, { label: string; icon: string; style: string }> = {
  none: { label: "One-time", icon: "📌", style: "bg-zinc-800 text-zinc-400 border-zinc-700" },
  daily: { label: "Daily", icon: "🔁", style: "bg-indigo-950/80 text-indigo-300 border-indigo-700/80" },
  weekly: { label: "Weekly", icon: "📅", style: "bg-purple-950/80 text-purple-300 border-purple-700/80" },
  weekdays: { label: "Weekdays (Mon–Fri)", icon: "💼", style: "bg-blue-950/80 text-blue-300 border-blue-700/80" },
  monthly: { label: "Monthly", icon: "🗓️", style: "bg-amber-950/80 text-amber-300 border-amber-700/80" },
};

function RecurrencePill({ recurrence }: { recurrence?: string }) {
  const rec = RECURRENCE_LABELS[recurrence?.toLowerCase() || "none"] ?? RECURRENCE_LABELS.none;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${rec.style}`}>
      <span>{rec.icon}</span>
      <span>{rec.label}</span>
    </span>
  );
}

// ─── Due Date Helper ────────────────────────────────────────────────────────
function formatDueTime(isoString: string): { formatted: string; isPast: boolean } {
  const date = new Date(isoString);
  const now = new Date();
  const isPast = date.getTime() < now.getTime();

  const formatted = date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return { formatted, isPast };
}

// ─── Create / Edit Reminder Modal ────────────────────────────────────────────
interface ReminderModalProps {
  reminder?: ReminderItem | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description?: string;
    due_time: string;
    recurrence: string;
    is_active?: boolean;
  }) => Promise<void>;
}

function ReminderModal({ reminder, onClose, onSave }: ReminderModalProps) {
  const isEditing = !!reminder;
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [description, setDescription] = useState(reminder?.description ?? "");
  
  // Format to YYYY-MM-DDTHH:mm for datetime-local
  const defaultDue = reminder?.due_time
    ? new Date(reminder.due_time).toISOString().slice(0, 16)
    : new Date(Date.now() + 3600000).toISOString().slice(0, 16); // 1 hr from now default

  const [dueTime, setDueTime] = useState(defaultDue);
  const [recurrence, setRecurrence] = useState(reminder?.recurrence ?? "none");
  const [isActive, setIsActive] = useState(reminder?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!dueTime) {
      setError("Due date and time is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        due_time: new Date(dueTime).toISOString(),
        recurrence,
        is_active: isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save reminder.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <span>⏰</span> {isEditing ? "Edit Reminder" : "Schedule New Reminder"}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg transition">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sync engineering sprint tasks & check n8n digests…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Additional details or meeting links…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Due Date & Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Recurrence Schedule
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="none">One-time (No repeat)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="weekdays">Weekdays (Mon–Fri)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_active" className="text-xs text-zinc-300 select-none cursor-pointer">
              Active reminder (fires notification webhook to Google Calendar)
            </label>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition disabled:opacity-50 shadow-md shadow-indigo-600/20"
            >
              {submitting ? "Saving…" : isEditing ? "Save Changes" : "Create Reminder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Reminders Page ────────────────────────────────────────────────────
export default function RemindersPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state: 'all' | 'active' | 'inactive'
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);

  const loadReminders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReminders();
      setReminders(data);
    } catch (err: any) {
      if (err?.message?.includes("Session expired") || err?.message?.includes("credentials")) {
        removeToken();
        router.push("/login");
        return;
      }
      setError(err?.message || "Failed to load reminders.");
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
    loadReminders();
  }, [router, loadReminders]);

  // Handlers
  const handleCreate = async (data: any) => {
    await createReminder(data);
    await loadReminders();
  };

  const handleUpdate = async (data: any) => {
    if (!editingReminder) return;
    await updateReminder(editingReminder.id, data);
    await loadReminders();
  };

  const handleToggleActive = async (reminder: ReminderItem) => {
    try {
      await updateReminder(reminder.id, { is_active: !reminder.is_active });
      await loadReminders();
    } catch (err: any) {
      alert(err.message || "Failed to toggle reminder status");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this reminder? If synced, its Google Calendar event will also be removed.")) return;
    try {
      await deleteReminder(id);
      await loadReminders();
    } catch (err: any) {
      alert(err.message || "Failed to delete reminder");
    }
  };

  // Filtered List
  const filteredReminders = reminders.filter((r) => {
    if (filter === "active") return r.is_active;
    if (filter === "inactive") return !r.is_active;
    return true;
  });

  // Summary Metrics
  const totalReminders = reminders.length;
  const activeCount = reminders.filter((r) => r.is_active).length;
  const gcalSyncedCount = reminders.filter((r) => !!r.gcal_event_id).length;

  return (
    <>
      {modalOpen && (
        <ReminderModal
          reminder={editingReminder}
          onClose={() => {
            setModalOpen(false);
            setEditingReminder(null);
          }}
          onSave={editingReminder ? handleUpdate : handleCreate}
        />
      )}

      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Top Header ── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                ⏰ Scheduled Reminders
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Configure time-based notifications with automated Google Calendar synchronization via n8n.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingReminder(null);
                setModalOpen(true);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition duration-150 shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              <span className="text-base leading-none">+</span>
              <span>New Reminder</span>
            </button>
          </div>

          {/* ── Summary Metrics ── */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>⏰</span> Total Reminders
              </span>
              <p className="text-3xl font-black text-zinc-100">{totalReminders}</p>
              <p className="text-xs text-zinc-500">Configured notification schedules</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>⚡</span> Active Notifications
              </span>
              <p className="text-3xl font-black text-emerald-400">{activeCount}</p>
              <p className="text-xs text-zinc-500">Armed and ready to trigger</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>📅</span> Google Calendar Synced
              </span>
              <p className="text-3xl font-black text-indigo-400">{gcalSyncedCount}</p>
              <p className="text-xs text-zinc-500">Integrated with n8n calendar webhook</p>
            </div>
          </section>

          {/* ── Filter Tabs ── */}
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
            <button
              onClick={() => setFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              All ({reminders.length})
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "active"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter("inactive")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === "inactive"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              Inactive ({totalReminders - activeCount})
            </button>
          </div>

          {/* ── Reminder Feed ── */}
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-500">Loading your scheduled reminders…</p>
            </div>
          ) : error ? (
            <div className="bg-zinc-900 border border-red-800 rounded-2xl p-8 text-center max-w-sm mx-auto space-y-4">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={loadReminders}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
              >
                Retry
              </button>
            </div>
          ) : filteredReminders.length === 0 ? (
            <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-4">
              <span className="text-4xl block">⏰</span>
              <h3 className="text-lg font-bold text-zinc-200">No Reminders Found</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                {filter === "all"
                  ? "Never miss an important event or routine. Schedule a new reminder with optional Google Calendar synchronization!"
                  : `No ${filter} reminders found.`}
              </p>
              {filter === "all" && (
                <button
                  onClick={() => {
                    setEditingReminder(null);
                    setModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-lg shadow-indigo-600/20"
                >
                  + Schedule Your First Reminder
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReminders.map((reminder) => {
                const { formatted, isPast } = formatDueTime(reminder.due_time);
                const hasGcal = !!reminder.gcal_event_id;

                return (
                  <div
                    key={reminder.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      !reminder.is_active
                        ? "bg-zinc-950/40 border-zinc-800/40 opacity-60"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {/* Left: Info */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className={`text-base font-bold truncate ${!reminder.is_active ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
                          {reminder.title}
                        </h3>
                        <RecurrencePill recurrence={reminder.recurrence} />

                        {/* Google Calendar Sync Pill */}
                        {hasGcal ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center gap-1"
                            title={`Synced to Google Calendar (Event ID: ${reminder.gcal_event_id})`}
                          >
                            <span>📅</span>
                            <span>GCal Synced</span>
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center gap-1"
                            title="Local database schedule"
                          >
                            <span>⚡</span>
                            <span>Local</span>
                          </span>
                        )}
                      </div>

                      {reminder.description && (
                        <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                          {reminder.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-medium ${isPast && reminder.is_active ? "text-red-400" : "text-zinc-400"}`}>
                          ⏰ {formatted}
                        </span>
                        {isPast && reminder.is_active && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-950 border border-red-800 text-red-300 uppercase">
                            Passed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
                      {/* Active toggle button */}
                      <button
                        onClick={() => handleToggleActive(reminder)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          reminder.is_active
                            ? "bg-emerald-950/70 border-emerald-700 text-emerald-300 hover:bg-emerald-900/80"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {reminder.is_active ? "Active ✓" : "Paused"}
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => {
                          setEditingReminder(reminder);
                          setModalOpen(true);
                        }}
                        className="p-2 rounded-xl text-zinc-400 hover:text-indigo-300 hover:bg-zinc-800 transition text-sm"
                        title="Edit reminder"
                      >
                        ✏️
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDelete(reminder.id)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition text-sm"
                        title="Delete reminder"
                      >
                        🗑️
                      </button>
                    </div>
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
