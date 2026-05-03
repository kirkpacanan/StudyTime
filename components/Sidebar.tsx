"use client";

import { cn } from "@/lib/cn";
import { StudyTimeWordmark } from "@/components/StudyTimeLogo";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { LayoutGroup, motion } from "framer-motion";
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
      <motion.button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-surface/95 shadow-sm backdrop-blur md:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 520, damping: 28 }}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </motion.button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r border-primary/10 bg-surface/95 pt-16 shadow-soft backdrop-blur-md transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] dark:border-white/5 dark:bg-slate-950/95 dark:shadow-soft-dark md:static md:translate-x-0 md:pt-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center border-b border-primary/10 px-4 dark:border-white/5">
          <StudyTimeWordmark
            logoSize={36}
            className="gap-2.5"
            titleClassName="text-sm"
          />
        </div>
        <LayoutGroup>
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
                    "relative block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                    active
                      ? "text-primary"
                      : "text-muted hover:bg-primary-soft/50 hover:text-text",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 -z-0 rounded-xl bg-primary-soft shadow-[inset_0_0_0_1px_rgba(79,134,247,0.12)]"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  ) : null}
                  <span className="relative z-10 flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-xs text-muted md:static">
          Calm motion · smooth study flow.
        </div>
      </aside>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-text/25 backdrop-blur-[2px] transition-opacity duration-200 md:hidden"
          aria-label="Close overlay"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
