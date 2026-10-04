"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Desk" },
  { href: "/how-it-works", label: "How it works" },
];

const GITHUB_URL = "https://github.com/AmmaraKashaf/violation-desk";
const LOOM_URL = "https://www.loom.com/"; // placeholder until the demo video is recorded

const EXTERNAL_LINKS: { href: string; label: string }[] = [
  { href: GITHUB_URL, label: "GitHub" },
  { href: LOOM_URL, label: "Loom" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="leading-tight">
          <span className="block font-semibold tracking-tight">Violation Desk</span>
          <span className="block text-xs text-slate-400">Next.js | FastAPI | Supabase</span>
        </Link>

        {/* Scrolls sideways on narrow screens instead of breaking the layout. */}
        <div className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${
                  isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex gap-4 text-sm">
          {EXTERNAL_LINKS.map(({ href, label }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-900">
              {label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
