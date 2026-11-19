"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getToken,
  removeToken,
  fetchJournals,
  fetchJournalById,
  createJournal,
  updateJournal,
  deleteJournal,
  searchJournals,
  JournalSummaryItem,
  JournalDetailItem,
  JournalSearchResult,
} from "@/lib/api";

// ─── Entry Detail & Edit Modal ──────────────────────────────────────────────
interface EntryModalProps {
  entryId: number;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

function EntryDetailModal({ entryId, onClose, onUpdated, onDeleted }: EntryModalProps) {
  const router = useRouter();
  const [entry, setEntry] = useState<JournalDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchJournalById(entryId);
      setEntry(data);
      setTitle(data.title || "");
      setContent(data.content);
    } catch (err: any) {
      setError(err.message || "Failed to load entry details.");
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  const handleSave = async () => {
    if (!content.trim()) {
      alert("Content cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateJournal(entryId, {
        title: title.trim() || undefined,
        content: content.trim(),
      });
      setIsEditing(false);
      onUpdated();
      await loadEntry();
    } catch (err: any) {
      alert(err.message || "Failed to update entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this journal entry? Its vector embeddings will also be purged.")) return;
    setDeleting(true);
    try {
      await deleteJournal(entryId);
      onDeleted();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to delete entry.");
    } finally {
      setDeleting(false);
    }
  };

  const handleAskAI = () => {
    // Navigate to Chat page
    router.push("/chat");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/90 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              {isEditing ? "Editing Entry" : "Journal Entry"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg transition p-1"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-500">Loading full entry…</p>
            </div>
          ) : error || !entry ? (
            <p className="text-red-400 text-sm text-center py-8">{error || "Entry not found."}</p>
          ) : isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Optional title…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  Notes & Content <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={10}
                  required
                  placeholder="Write your reflections, learnings, or ideas…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono leading-relaxed resize-none"
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                ⚡ Saving will automatically re-chunk and regenerate 768-dim vector embeddings in Supabase.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
                  {entry.title || "Untitled Entry"}
                </h2>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                  <span>
                    📅 {new Date(entry.created_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span>·</span>
                  <span>{new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {entry.content}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && entry && (
          <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/95 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            {isEditing ? (
              <div className="flex gap-2 w-full sm:w-auto ml-auto">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition disabled:opacity-50 shadow-md shadow-indigo-600/20"
                >
                  {saving ? "Re-embedding…" : "Save & Re-embed"}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAskAI}
                    className="px-3.5 py-2 rounded-xl bg-indigo-950/60 border border-indigo-700/80 hover:bg-indigo-900/70 text-indigo-300 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <span>💬</span>
                    <span>Ask AI About This</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition flex items-center gap-1"
                  >
                    <span>✏️</span>
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-800/80 text-xs font-semibold text-red-300 transition flex items-center gap-1 disabled:opacity-50"
                  >
                    <span>🗑️</span>
                    <span>{deleting ? "Deleting…" : "Delete"}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compose New Entry Modal (Drawer/Modal) ──────────────────────────────────
interface ComposeModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function ComposeModal({ onClose, onCreated }: ComposeModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Journal content is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createJournal({
        title: title.trim() || undefined,
        content: content.trim(),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create journal entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/90 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">✍️</span>
            <h3 className="text-base font-bold text-zinc-100">Compose Journal Entry</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg transition p-1"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Reflections on RAG embeddings & chunk sizes…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Notes & Learnings <span className="text-red-400">*</span>
                </label>
                <span className="text-[11px] text-zinc-500">{wordCount} words</span>
              </div>
              <textarea
                rows={9}
                required
                placeholder="Write freely. When you save, your notes are automatically partitioned into semantic chunks and embedded with 768-dim vectors for the Ask AI knowledge base…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/95 flex items-center justify-between gap-3 flex-shrink-0">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1.5 hidden sm:flex">
              <span>🧠</span>
              <span>pgvector auto-indexing enabled</span>
            </span>

            <div className="flex gap-2 w-full sm:w-auto ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition disabled:opacity-50 shadow-md shadow-indigo-600/20"
              >
                {submitting ? "Embedding & Saving…" : "Save Entry"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Journal Page ──────────────────────────────────────────────────────
export default function JournalPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JournalSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Modal states
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchJournals();
      setEntries(data);
    } catch (err: any) {
      if (err?.message?.includes("Session expired") || err?.message?.includes("credentials")) {
        removeToken();
        router.push("/login");
        return;
      }
      setError(err?.message || "Failed to load journal entries.");
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
    loadEntries();
  }, [router, loadEntries]);

  // Handle semantic search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      const res = await searchJournals(searchQuery.trim(), 6);
      setSearchResults(res.results);
    } catch (err: any) {
      alert(err.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  // Metrics
  const totalEntries = entries.length;
  const totalChunks = entries.reduce((acc, e) => acc + (e.chunks_count || 0), 0);

  return (
    <>
      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onCreated={loadEntries}
        />
      )}

      {selectedEntryId !== null && (
        <EntryDetailModal
          entryId={selectedEntryId}
          onClose={() => setSelectedEntryId(null)}
          onUpdated={loadEntries}
          onDeleted={loadEntries}
        />
      )}

      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Top Header ── */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                📝 Personal Knowledge Base
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Reflections, sprint notes, and vector-embedded documentation for Ask AI.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Link
                href="/chat"
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>💬</span>
                <span>Ask AI</span>
              </Link>
              <button
                onClick={() => setComposeOpen(true)}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition duration-150 shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
              >
                <span className="text-base leading-none">+</span>
                <span>Compose Entry</span>
              </button>
            </div>
          </div>

          {/* ── Metrics Summary ── */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>📚</span> Journal Entries
              </span>
              <p className="text-3xl font-black text-zinc-100">{totalEntries}</p>
              <p className="text-xs text-zinc-500">Documented personal records</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>🧠</span> pgvector Index Chunks
              </span>
              <p className="text-3xl font-black text-indigo-400">{totalChunks}</p>
              <p className="text-xs text-zinc-500">768-dimensional embeddings indexed in Supabase</p>
            </div>
          </section>

          {/* ── Semantic Vector Search Bar ── */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <span>🔍</span> Semantic Vector Search
              </span>
              {searchResults !== null && (
                <button
                  onClick={clearSearch}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                >
                  Clear Results & View All
                </button>
              )}
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Search your notes semantically (e.g. 'token bugs in oauth', 'chunking tradeoff', 'workout routine')…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition disabled:opacity-50 flex-shrink-0 shadow-md shadow-indigo-600/20"
              >
                {searching ? "Searching…" : "Search"}
              </button>
            </form>
          </section>

          {/* ── Search Results View (If active) ── */}
          {searchResults !== null && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                  <span>⚡</span> Semantic Matches for &ldquo;{searchQuery}&rdquo;
                </h3>
                <span className="text-xs text-zinc-500">
                  {searchResults.length} {searchResults.length === 1 ? "chunk" : "chunks"} found
                </span>
              </div>

              {searchResults.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-sm">
                  No matching entries found. Try different natural language keywords!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedEntryId(result.id)}
                      className="bg-zinc-900 border border-indigo-900/60 hover:border-indigo-600/80 rounded-2xl p-5 space-y-3 cursor-pointer transition duration-150 shadow-md hover:shadow-indigo-950/40 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-zinc-100 truncate group-hover:text-indigo-300 transition">
                          {result.title || "Untitled Entry"}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-300">
                          {Math.round((result.similarity ?? (1 - (result.distance ?? 0))) * 100)}% match
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed font-sans">
                        &ldquo;{result.content}&rdquo;
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/80">
                        <span>Chunk #{result.chunk_index + 1}</span>
                        <span className="text-indigo-400 group-hover:underline">View Full Entry →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Chronological Entries Feed (Default View) ── */}
          {searchResults === null && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                <span>📖</span> All Journal Entries
              </h3>

              {loading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-zinc-500">Loading your knowledge base…</p>
                </div>
              ) : error ? (
                <div className="bg-zinc-900 border border-red-800 rounded-2xl p-8 text-center max-w-sm mx-auto space-y-4">
                  <p className="text-red-400 text-sm">{error}</p>
                  <button
                    onClick={loadEntries}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
                  >
                    Retry
                  </button>
                </div>
              ) : entries.length === 0 ? (
                <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-4">
                  <span className="text-4xl block">📝</span>
                  <h3 className="text-lg font-bold text-zinc-200">No Journal Entries Yet</h3>
                  <p className="text-sm text-zinc-500 max-w-md mx-auto">
                    Start recording your reflections, daily learnings, and sprint logs. Every entry is automatically embedded to power your personal AI assistant!
                  </p>
                  <button
                    onClick={() => setComposeOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-lg shadow-indigo-600/20"
                  >
                    + Compose Your First Entry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntryId(entry.id)}
                      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 space-y-3 cursor-pointer transition duration-150 hover:bg-zinc-900/80 group shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="text-base font-bold text-zinc-100 truncate group-hover:text-indigo-400 transition">
                            {entry.title || "Untitled Entry"}
                          </h4>
                          <p className="text-[11px] text-zinc-500">
                            {new Date(entry.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center gap-1 flex-shrink-0">
                          <span>⚡</span>
                          <span>{entry.chunks_count} {entry.chunks_count === 1 ? "chunk" : "chunks"}</span>
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                        {entry.snippet}
                      </p>

                      <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] text-zinc-500">Tap to read & edit</span>
                        <span className="text-indigo-400 text-xs font-medium group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                          Open →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </>
  );
}
