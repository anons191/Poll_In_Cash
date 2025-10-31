import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poll in Cash",
  description: "Get paid in USDC for completing polls on Base.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0A0B0F] text-[#E6EAF2]">
        <header className="border-b border-white/10">
          <div className="mx-auto max-w-5xl p-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Poll in Cash</h1>
            <div className="text-sm opacity-80">MVP · Day 1</div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </body>
    </html>
  );
}
