"use client";

import { cn } from "@/lib/cn";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Menu,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/session", label: "Study session", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-surface shadow-sm md:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r border-primary/10 bg-surface pt-16 shadow-soft transition-transform md:static md:translate-x-0 md:pt-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-primary/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <BookOpen className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">StudyTime</p>
            <p className="text-xs text-muted">Focus & performance</p>
          </div>
        </div>
        <nav className="space-y-1 p-3" aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-primary-soft/50 hover:text-text",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-xs text-muted md:static">
          Calm colors for low-stress study blocks.
        </div>
      </aside>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-text/20 md:hidden"
          aria-label="Close overlay"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
