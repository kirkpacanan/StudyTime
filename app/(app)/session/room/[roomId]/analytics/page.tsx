"use client";

import { getLibraryRoomAnalytics, getLibraryRoomById, getLibraryRoomRole } from "@/lib/library-rooms";
import type { LibraryRoom, LibraryRoomAnalyticsRow } from "@/lib/library-rooms";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, BarChart3, Clock, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  color?: string;
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

function formatFocusMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function LibraryRoomAnalyticsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<LibraryRoom | null>(null);
  const [rows, setRows] = useState<LibraryRoomAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [r, role] = await Promise.all([
        getLibraryRoomById(roomId),
        getLibraryRoomRole(roomId),
      ]);
      if (!r || role !== "host") {
        router.replace(`/session/room/${roomId}`);
        return;
      }
      setRoom(r);
      try {
        const analytics = await getLibraryRoomAnalytics(roomId);
        setRows(analytics);
      } catch {
        setRows([]);
      }
      setLoading(false);
    })();
  }, [roomId, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-[var(--cc-border)] bg-white/5"
          />
        ))}
      </div>
    );
  }

  const totalSessions = rows.reduce((s, r) => s + Number(r.session_count), 0);
  const overallAvg =
    rows.length > 0
      ? Math.round(
          rows.reduce((s, r) => s + Number(r.avg_focus), 0) / rows.length,
        )
      : 0;
  const totalFocusMs = rows.reduce((s, r) => s + Number(r.total_focus_ms), 0);
  const totalLowFocus = rows.reduce((s, r) => s + Number(r.low_focus_count), 0);

  const chartData = rows.slice(0, 10).map((r) => ({
    name: r.user_name.length > 14 ? r.user_name.slice(0, 12) + "…" : r.user_name,
    avg: Number(r.avg_focus),
    sessions: Number(r.session_count),
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
          href={`/session/room/${roomId}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cc-border)] bg-white/5 text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-text">Room Analytics</h1>
          </div>
          <p className="text-sm text-muted">{room?.name}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Members with sessions" value={rows.length} icon={Users} />
        <StatCard
          label="Total sessions"
          value={totalSessions}
          icon={TrendingUp}
          color="text-emerald-400"
        />
        <StatCard
          label="Avg focus"
          value={`${overallAvg}%`}
          icon={BarChart3}
          color="text-cyan-400"
        />
        <StatCard
          label="Total focus time"
          value={formatFocusMs(totalFocusMs)}
          icon={Clock}
        />
      </div>

      {totalLowFocus > 0 && (
        <p className="text-sm text-amber-400">
          {totalLowFocus} session{totalLowFocus !== 1 ? "s" : ""} below 50% average focus
        </p>
      )}

      {chartData.length > 0 ? (
        <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4">
          <h2 className="mb-4 text-sm font-semibold text-text">Member average focus</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--cc-surface)",
                  border: "1px solid var(--cc-border)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="avg" fill="#22d3ee" radius={[6, 6, 0, 0]} name="Avg focus %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--cc-border)] bg-[var(--cc-surface)] px-6 py-12 text-center">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted/40" />
          <p className="text-sm text-muted">
            No completed study sessions in this room yet.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[var(--cc-border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--cc-border)] bg-white/5 text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">Avg focus</th>
                <th className="px-4 py-3 font-medium">Focus time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-[var(--cc-border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-text">{r.user_name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">{r.session_count}</td>
                  <td className="px-4 py-3 tabular-nums text-emerald-400">{r.avg_focus}%</td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {formatFocusMs(Number(r.total_focus_ms))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
