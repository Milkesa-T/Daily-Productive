"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserEmail, logoutUser, getToken } from "@/lib/api";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Goals", href: "/goals", icon: "🎯" },
  { name: "Journal", href: "/journal", icon: "📝" },
  { name: "Reminders", href: "/reminders", icon: "⏰" },
  { name: "Ask AI", href: "/chat", icon: "💬" },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getToken();
    if (!token && pathname !== "/login") {
      router.replace("/login");
      return;
    }
    setEmail(getUserEmail());
  }, [pathname, router]);

  // Do not show navigation on login page
  if (pathname === "/login") {
    return null;
  }

  const handleLogout = () => {
    logoutUser();
    router.replace("/login");
  };

  return (
    <>
      {/* --- Desktop & Tablet Top Navigation Bar --- */}
      <header className="sticky top-0 z-50 w-full bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/25 group-hover:scale-105 transition duration-200">
              <span className="text-base font-black">DP</span>
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Daily-Productive
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/60">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition duration-150 ${
                    isActive
                      ? "bg-zinc-800 text-white shadow-sm shadow-black/40 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Auth Session State & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {mounted && email && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 font-mono shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="max-w-[140px] truncate" title={email}>
                  {email}
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              title="Sign out of your session"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-red-300 bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 hover:border-red-800/60 transition duration-150 focus:outline-none"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- Sticky Mobile Bottom-Tab Bar (Thumb-Friendly for Mobile) --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800/90 pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="grid grid-cols-5 h-16">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 transition duration-150 relative ${
                  isActive
                    ? "text-indigo-400 font-bold bg-indigo-950/20"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                )}
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[10px] tracking-tight">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
