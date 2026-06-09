"use client";

import { cn } from "@/lib/cn";
import { LayoutGroup, motion } from "framer-motion";

export type FocusHubTab = {
  id: string;
  label: string;
  hostOnly?: boolean;
};

type FocusHubTabBarProps = {
  tabs: FocusHubTab[];
  active: string;
  isHost: boolean;
  onChange: (id: string) => void;
};

export function FocusHubTabBar({ tabs, active, isHost, onChange }: FocusHubTabBarProps) {
  const visible = tabs.filter((t) => !t.hostOnly || isHost);

  return (
    <LayoutGroup id="focus-hub-tabs">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--cc-border)] pb-0 scrollbar-none">
        {visible.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative shrink-0 px-4 pb-3 pt-1 text-sm font-medium transition-colors",
              active === tab.id ? "text-primary" : "text-muted hover:text-text",
            )}
          >
            {active === tab.id && (
              <motion.span
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {tab.label}
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
