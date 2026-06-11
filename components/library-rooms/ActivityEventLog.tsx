"use client";

import {
  snapshotEventLabel,
  type ActivityEventLogRow,
} from "@/lib/room-monitoring";
import { cn } from "@/lib/cn";
import { Monitor, User } from "lucide-react";
import { useState } from "react";

function formatDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

type ActivityEventLogProps = {
  rows: ActivityEventLogRow[];
  loading?: boolean;
};

export function ActivityEventLog({ rows, loading }: ActivityEventLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return <p className="py-4 text-center text-xs text-muted">Loading activity log…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted">
        No numbered events recorded for this session yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--cc-border)]">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead>
          <tr className="border-b border-[var(--cc-border)] bg-white/5 text-muted">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Event</th>
            <th className="px-3 py-2 font-medium">Date / time</th>
            <th className="px-3 py-2 font-medium">Duration</th>
            <th className="px-3 py-2 font-medium">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <tr
                key={row.id}
                className="border-b border-[var(--cc-border)]/60 last:border-0"
              >
                <td className="px-3 py-2 font-mono text-sky-200">{row.event_index}</td>
                <td className="px-3 py-2 text-text">
                  {snapshotEventLabel(row.event_type as never)}
                </td>
                <td className="px-3 py-2 text-muted">
                  {new Date(row.occurred_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-muted">{formatDuration(row.duration_ms)}</td>
                <td className="px-3 py-2">
                  {(row.webcam_signed_url || row.screen_signed_url) ? (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      className="text-sky-300 underline-offset-2 hover:underline"
                    >
                      {expanded ? "Hide" : "View"}
                    </button>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {expandedId ? (
        (() => {
          const row = rows.find((r) => r.id === expandedId);
          if (!row) return null;
          return (
            <div className="grid gap-3 border-t border-[var(--cc-border)] bg-white/[0.03] p-3 sm:grid-cols-2">
              <EvidenceThumb
                label="Webcam"
                icon={<User className="h-3.5 w-3.5" />}
                url={row.webcam_signed_url}
              />
              <EvidenceThumb
                label="Screen"
                icon={<Monitor className="h-3.5 w-3.5" />}
                url={row.screen_signed_url}
              />
            </div>
          );
        })()
      ) : null}
    </div>
  );
}

function EvidenceThumb({
  label,
  icon,
  url,
}: {
  label: string;
  icon: React.ReactNode;
  url?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--cc-border)] bg-black/20 p-2">
      <p className={cn("mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase text-muted")}>
        {icon}
        {label}
      </p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${label} evidence`}
            className="max-h-40 w-full rounded-md object-cover"
          />
        </a>
      ) : (
        <p className="py-6 text-center text-[10px] text-muted">Not captured</p>
      )}
    </div>
  );
}
