import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily-Productive",
  description: "Personal Productivity & RAG Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-zinc-950 text-zinc-100 antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
