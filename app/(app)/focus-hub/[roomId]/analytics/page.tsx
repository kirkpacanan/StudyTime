"use client";

import { getRoomAnalytics } from "@/lib/focus-hub/client";
import { ACTIVITY_TYPE_LABELS, type RoomAnalyticsRow } from "@/lib/focus-hub/types";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, BarChart3, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string | undefined;
}) {
  const colorCls = color ?? "text-text";
  return (
    <div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${colorCls}`}>{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [rows, setRows] = useState<RoomAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getRoomAnalytics(roomId).then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, [roomId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5" />
        ))}
      </div>
    );
  }

  const completedRows = rows.filter((r) => r.ended_at !== null);
  const overallAvg =
    completedRows.length > 0
      ? Math.round(
          completedRows.reduce((s, r) => s + (r.avg_focus ?? 0), 0) /
            completedRows.length,
        )
      : 0;
  const totalParticipants = completedRows.reduce(
    (s, r) => s + Number(r.participant_count),
    0,
  );
  const totalFlagged = completedRows.reduce(
    (s, r) => s + Number(r.flagged_count),
    0,
  );

  const chartData = completedRows.slice(0, 10).map((r) => ({
    name:
      r.activity_title.length > 16
        ? r.activity_title.slice(0, 14) + "…"
        : r.activity_title,
    avg: r.avg_focus ?? 0,
    participants: Number(r.participant_count),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36 }}
      className="mx-auto max-w-4xl space-y-8"
    >
      <div className="flex items-center gap-3">
        <Link
          href={`/focus-hub/${roomId}`}
          className="rounded-xl border border-[var(--cc-border)] p-2 text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text">Analytics</h1>
          <p className="text-xs text-muted">Room performance overview</p>
        </div>
      </div>

      {completedRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--cc-border)] py-16 text-center text-muted">
          <BarChart3 className="h-10 w-10 opacity-40" />
          <p className="text-sm">No completed activities yet.</p>
          <p className="text-xs opacity-70">
            Analytics will appear here once activities have been completed.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Activities"
              value={completedRows.length}
              icon={BarChart3}
            />
            <StatCard
              label="Avg Focus"
              value={`${overallAvg}%`}
              icon={TrendingUp}
              color={
                overallAvg >= 70
                  ? "text-emerald-400"
                  : overallAvg >= 50
                    ? "text-yellow-400"
                    : "text-red-400"
              }
            />
            <StatCard
              label="Total Participants"
              value={totalParticipants}
              icon={Users}
            />
            <StatCard
              label="Flagged Sessions"
              value={totalFlagged}
              icon={BarChart3}
              color={totalFlagged > 0 ? "text-red-400" : "text-text"}
            />
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5">
              <p className="mb-4 text-sm font-semibold text-text">
                Average Focus by Activity
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={24}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--cc-surface)",
                      border: "1px solid var(--cc-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${v}%`, "Avg Focus"]}
                  />
                  <Bar dataKey="avg" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Activity table */}
          <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--cc-border)]">
                  {["Activity", "Type", "Participants", "Avg Focus", "Flagged", "Submitted"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium text-muted"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {completedRows.map((r) => (
                  <tr
                    key={r.activity_id}
                    className="border-b border-[var(--cc-border)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-text">
                      {r.activity_title}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {ACTIVITY_TYPE_LABELS[r.activity_type]}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {r.participant_count}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "font-semibold tabular-nums " +
                          (Number(r.avg_focus) >= 70
                            ? "text-emerald-400"
                            : Number(r.avg_focus) >= 50
                              ? "text-yellow-400"
                              : "text-red-400")
                        }
                      >
                        {r.avg_focus ?? "—"}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {r.flagged_count > 0 ? (
                        <span className="text-red-400">{r.flagged_count}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.submitted_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </motion.div>
  );
}
