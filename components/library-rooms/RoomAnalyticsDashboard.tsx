"use client";

import { useHostLibraryRoom } from "@/hooks/useHostLibraryRoom";
import type { LibraryRoomAnalyticsRow } from "@/lib/library-rooms";
import {
  downloadRoomAnalyticsBlob,
  exportRoomAnalyticsXlsx,
} from "@/lib/export-room-analytics-xlsx";
import {
  focusBand,
  focusBandClasses,
  focusBandLabel,
  getRoomMemberSessions,
  getRoomMonitoringSnapshots,
  snapshotEventLabel,
  type RoomMemberSessionRow,
  type RoomMonitoringSnapshot,
} from "@/lib/room-monitoring";
import { cn } from "@/lib/cn";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  UserX,
  Wind,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatFocusMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSessionT(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type RoomAnalyticsDashboardProps = {
  roomId: string;
  roomName: string;
  rows: LibraryRoomAnalyticsRow[];
};

export function RoomAnalyticsDashboard({
  roomId,
  roomName,
  rows,
}: RoomAnalyticsDashboardProps) {
  const { participants, avgScore, flaggedCount } = useHostLibraryRoom(roomId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessionsCache, setSessionsCache] = useState<Record<string, RoomMemberSessionRow[]>>({});
  const [snapshotsCache, setSnapshotsCache] = useState<Record<string, RoomMonitoringSnapshot[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const liveByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of participants) map.set(p.userId, p.score);
    return map;
  }, [participants]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.user_name.localeCompare(b.user_name)),
    [rows],
  );

  const totals = useMemo(() => {
    const totalSessions = rows.reduce((s, r) => s + Number(r.session_count), 0);
    const withSessions = rows.filter((r) => Number(r.session_count) > 0);
    const overallAvg =
      withSessions.length > 0
        ? Math.round(
            withSessions.reduce((s, r) => s + Number(r.avg_focus), 0) /
              withSessions.length,
          )
        : 0;
    const totalFocusMs = rows.reduce((s, r) => s + Number(r.total_focus_ms), 0);
    const phoneTotal = rows.reduce((s, r) => s + Number(r.phone_events ?? 0), 0);
    const driftTotal = rows.reduce((s, r) => s + Number(r.drift_events ?? 0), 0);
    const offTotal = rows.reduce((s, r) => s + Number(r.off_screen_events ?? 0), 0);
    return { totalSessions, overallAvg, totalFocusMs, phoneTotal, driftTotal, offTotal };
  }, [rows]);

  const loadMemberDetail = useCallback(
    async (userId: string) => {
      if (sessionsCache[userId] && snapshotsCache[userId]) return;
      setLoadingDetail(userId);
      try {
        const [sessions, snapshots] = await Promise.all([
          getRoomMemberSessions(roomId, userId),
          getRoomMonitoringSnapshots(roomId, userId),
        ]);
        setSessionsCache((prev) => ({ ...prev, [userId]: sessions }));
        setSnapshotsCache((prev) => ({ ...prev, [userId]: snapshots }));
      } catch {
        setSessionsCache((prev) => ({ ...prev, [userId]: [] }));
        setSnapshotsCache((prev) => ({ ...prev, [userId]: [] }));
      } finally {
        setLoadingDetail(null);
      }
    },
    [roomId, sessionsCache, snapshotsCache],
  );

  useEffect(() => {
    if (expandedId) void loadMemberDetail(expandedId);
  }, [expandedId, loadMemberDetail]);

  async function handleExport() {
    setExporting(true);
    try {
      const sessionsByUser: Record<string, RoomMemberSessionRow[]> = { ...sessionsCache };
      for (const row of sortedRows) {
        if (!sessionsByUser[row.user_id]) {
          sessionsByUser[row.user_id] = await getRoomMemberSessions(roomId, row.user_id);
        }
      }
      const blob = await exportRoomAnalyticsXlsx({
        roomName,
        exportedAt: new Date().toLocaleString(),
        members: sortedRows,
        sessionsByUser,
      });
      downloadRoomAnalyticsBlob(blob, roomName);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/session/room/${roomId}/monitor`}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15"
          >
            <Monitor className="h-3.5 w-3.5" />
            Open live monitor
          </Link>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || sortedRows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--cc-border)] bg-white/5 px-3 py-2 text-xs font-semibold text-text transition hover:bg-white/10 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Preparing…" : "Download Excel report"}
          </button>
        </div>
      </div>

      {participants.length > 0 && (
        <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text">Live now</h2>
            <div className="flex gap-3 text-xs text-muted">
              <span>
                Room avg: <strong className="text-cyan-300">{avgScore}%</strong>
              </span>
              {flaggedCount > 0 && (
                <span className="text-red-400">
                  {flaggedCount} flagged
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...participants]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => {
                const band = focusBand(p.score);
                const cls = focusBandClasses(band);
                return (
                  <div
                    key={p.userId}
                    className={cn(
                      "rounded-xl border px-3 py-2",
                      cls.border,
                      cls.bg,
                    )}
                  >
                    <p className="text-xs font-semibold text-text">{p.name}</p>
                    <p className={cn("text-lg font-bold tabular-nums", cls.text)}>
                      {p.score}%
                      {p.flagged && (
                        <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-red-400" />
                      )}
                    </p>
                    <p className="text-[10px] text-muted">{focusBandLabel(band)}</p>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Room members" value={sortedRows.length} />
        <MetricCard label="Total sessions" value={totals.totalSessions} accent="text-emerald-400" />
        <MetricCard label="Avg focus" value={`${totals.overallAvg}%`} accent="text-cyan-400" />
        <MetricCard label="Total focus time" value={formatFocusMs(totals.totalFocusMs)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DistractionPill icon={Smartphone} label="Phone alerts" value={totals.phoneTotal} tone="red" />
        <DistractionPill icon={Wind} label="Drift events" value={totals.driftTotal} tone="amber" />
        <DistractionPill icon={UserX} label="Off screen" value={totals.offTotal} tone="red" />
      </div>

      <p className="text-xs text-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Green = focused (70%+)
        {" · "}
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> Yellow = needs attention
        {" · "}
        <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Red = distracted
      </p>

      {sortedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--cc-border)] bg-[var(--cc-surface)] px-6 py-12 text-center">
          <p className="text-sm text-muted">No members in this room yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedRows.map((row) => {
            const liveScore = liveByUser.get(row.user_id);
            const displayScore =
              liveScore != null ? liveScore : Number(row.avg_focus);
            const band = focusBand(displayScore);
            const cls = focusBandClasses(band);
            const expanded = expandedId === row.user_id;
            const sessions = sessionsCache[row.user_id] ?? [];
            const snapshots = snapshotsCache[row.user_id] ?? [];

            return (
              <div
                key={row.user_id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-[var(--cc-surface)]",
                  cls.border,
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expanded ? null : row.user_id)
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">{row.user_name}</p>
                    <p className="text-xs text-muted">
                      {Number(row.session_count)} session
                      {Number(row.session_count) !== 1 ? "s" : ""}
                      {liveScore != null && (
                        <span className="ml-2 text-cyan-300">· Live {liveScore}%</span>
                      )}
                    </p>
                  </div>
                  <div className="hidden items-center gap-4 text-xs text-muted sm:flex">
                    <span className="inline-flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      {Number(row.phone_events ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Wind className="h-3 w-3" />
                      {Number(row.drift_events ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserX className="h-3 w-3" />
                      {Number(row.off_screen_events ?? 0)}
                    </span>
                  </div>
                  <div className={cn("rounded-lg px-3 py-1.5 text-right", cls.bg)}>
                    <p className={cn("text-lg font-bold tabular-nums", cls.text)}>
                      {displayScore}%
                    </p>
                    <p className="text-[10px] text-muted">{focusBandLabel(band)}</p>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-[var(--cc-border)] px-4 py-4">
                    {loadingDetail === row.user_id ? (
                      <p className="text-sm text-muted">Loading breakdown…</p>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid gap-3 sm:grid-cols-4 text-sm">
                          <MiniStat label="Focus time" value={formatFocusMs(Number(row.total_focus_ms))} />
                          <MiniStat label="Phone" value={String(row.phone_events ?? 0)} />
                          <MiniStat label="Drift" value={String(row.drift_events ?? 0)} />
                          <MiniStat label="Off screen" value={String(row.off_screen_events ?? 0)} />
                        </div>

                        {sessions.length > 0 ? (
                          <div>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                              Sessions
                            </h3>
                            <div className="overflow-x-auto rounded-xl border border-[var(--cc-border)]">
                              <table className="w-full min-w-[520px] text-left text-xs">
                                <thead className="bg-white/5 text-muted">
                                  <tr>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2">Focus</th>
                                    <th className="px-3 py-2">Time</th>
                                    <th className="px-3 py-2">Phone</th>
                                    <th className="px-3 py-2">Drift</th>
                                    <th className="px-3 py-2">Away</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessions.map((s) => {
                                    const sBand = focusBand(s.average_focus);
                                    const sCls = focusBandClasses(sBand);
                                    return (
                                      <tr key={s.session_id} className="border-t border-[var(--cc-border)]">
                                        <td className="px-3 py-2 text-muted">
                                          {new Date(s.ended_at).toLocaleDateString()}
                                        </td>
                                        <td className={cn("px-3 py-2 font-semibold tabular-nums", sCls.text)}>
                                          {s.average_focus}%
                                        </td>
                                        <td className="px-3 py-2 tabular-nums text-muted">
                                          {formatFocusMs(s.focus_ms)}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums">{s.phone_events}</td>
                                        <td className="px-3 py-2 tabular-nums">{s.drift_events}</td>
                                        <td className="px-3 py-2 tabular-nums">{s.off_screen_events}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted">No completed sessions yet.</p>
                        )}

                        {snapshots.length > 0 ? (
                          <div>
                            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                              <ImageIcon className="h-3.5 w-3.5" />
                              Monitoring photos (host only)
                            </h3>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                              {snapshots.map((snap) => (
                                <figure
                                  key={snap.id}
                                  className="overflow-hidden rounded-xl border border-[var(--cc-border)] bg-black/20"
                                >
                                  {snap.signed_url ? (
                                    <img
                                      src={snap.signed_url}
                                      alt={snapshotEventLabel(snap.event_type)}
                                      className="aspect-video w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex aspect-video items-center justify-center text-xs text-muted">
                                      Unavailable
                                    </div>
                                  )}
                                  <figcaption className="space-y-0.5 px-2 py-1.5 text-[10px] text-muted">
                                    <p className="font-semibold text-text">
                                      {snapshotEventLabel(snap.event_type)}
                                    </p>
                                    <p>@{formatSessionT(snap.session_t_ms)}</p>
                                  </figcaption>
                                </figure>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", accent ?? "text-text")}>{value}</p>
    </div>
  );
}

function DistractionPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Smartphone;
  label: string;
  value: number;
  tone: "red" | "amber";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        tone === "red"
          ? "border-red-500/20 bg-red-500/5"
          : "border-amber-500/20 bg-amber-500/5",
      )}
    >
      <Icon className={cn("h-4 w-4", tone === "red" ? "text-red-400" : "text-amber-400")} />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold tabular-nums text-text">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--cc-border)] bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-sm font-semibold text-text">{value}</p>
    </div>
  );
}
