"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, removeToken } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
    } else {
      setAuthenticated(true);
    }
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Authenticating...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center border-b border-zinc-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              Daily-Productive Dashboard
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Week 2 Sprint: Frontend connected to FastAPI & Supabase
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition"
          >
            Log Out
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-zinc-200">📋 Tasks</h3>
            <p className="text-sm text-zinc-400 mt-2">
              Ready for Day 14: Interactive Task & Habit lists with live
              Supabase CRUD!
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-zinc-200">🔁 Habits</h3>
            <p className="text-sm text-zinc-400 mt-2">
              Habit tracking & streak counters connected to Day 12 digest
              engine.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-zinc-200">🤖 AI & RAG</h3>
            <p className="text-sm text-zinc-400 mt-2">
              Week 3: pgvector embeddings & conversational chat assistant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
