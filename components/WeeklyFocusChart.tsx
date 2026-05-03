"use client";

import { useTheme } from "@/contexts/theme-context";
import type { DayAgg } from "@/lib/reports";
import { BarChart3 } from "lucide-react";
import { useId, useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ChartLegend({ isDark }: { isDark: boolean }) {
  const barSwatch = isDark
    ? "linear-gradient(180deg, rgba(248,250,252,0.38) 0%, rgba(148,163,184,0.28) 40%, rgba(59,130,246,0.45) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(191,219,254,0.75) 40%, rgba(59,130,246,0.62) 100%)";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-600 dark:text-muted">
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-sm shadow-sm ring-1 ring-black/[0.06] dark:ring-white/12"
          style={{ background: barSwatch }}
          aria-hidden
        />
        Study minutes
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="h-0.5 w-4 rounded-full bg-success shadow-sm ring-1 ring-success/30"
          aria-hidden
        />
        Avg focus %
      </span>
    </div>
  );
}

export function WeeklyFocusChart({ days }: { days: DayAgg[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const uid = useId().replace(/:/g, "");
  const barFillId = `barFillStudy-${uid}`;
  const barShadowId = `barShadow-${uid}`;

  const gridStroke = isDark
    ? "rgba(148, 163, 184, 0.12)"
    : "rgba(59, 130, 246, 0.12)";
  const axisStroke = isDark
    ? "rgba(148, 163, 184, 0.2)"
    : "rgba(59, 130, 246, 0.2)";

  const data = useMemo(
    () =>
      days.map((d) => ({
        name: d.label,
        minutes: d.studyMinutes,
        focus: d.avgFocus ?? 0,
      })),
    [days],
  );

  const hasStudyData = data.some((d) => d.minutes > 0);

  if (!hasStudyData) {
    return (
      <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300/80 bg-gradient-to-b from-white/50 to-sky-50/30 px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md dark:border-cyan-500/25 dark:from-slate-900/40 dark:to-slate-950/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-primary shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-slate-800/80 dark:text-cyan-300 dark:shadow-none">
          <BarChart3 className="h-7 w-7" aria-hidden />
        </div>
        <p className="max-w-sm text-sm font-medium text-text">
          No study minutes this week yet
        </p>
        <p className="max-w-xs text-xs leading-relaxed text-slate-600 dark:text-muted">
          Run a session and your bars will show up here — the chart updates from
          your saved focus blocks.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/35 px-3 py-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-800/35 dark:shadow-none sm:px-4">
        <ChartLegend isDark={isDark} />
      </div>
      <div className="h-[min(22rem,calc(100vw-3rem))] min-h-[18rem] w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, bottom: 6, left: 4 }}
          >
            <CartesianGrid
              strokeDasharray="4 6"
              stroke={gridStroke}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: axisStroke }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: axisStroke }}
              label={{
                value: "Minutes",
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--muted)", fontSize: 11 },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: axisStroke }}
              label={{
                value: "Avg focus %",
                angle: 90,
                position: "insideRight",
                style: { fill: "var(--muted)", fontSize: 11 },
              }}
            />
            <Tooltip
              cursor={{
                fill: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(79,134,247,0.08)",
              }}
              contentStyle={{
                borderRadius: 14,
                border: isDark
                  ? "1px solid rgba(255,255,255,0.12)"
                  : "1px solid rgba(255,255,255,0.65)",
                background: isDark
                  ? "rgba(15, 23, 42, 0.88)"
                  : "rgba(255, 255, 255, 0.82)",
                boxShadow: isDark
                  ? "0 12px 40px rgba(0,0,0,0.45)"
                  : "0 8px 32px rgba(79,134,247,0.12)",
                backdropFilter: "blur(16px) saturate(1.6)",
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="minutes"
              name="Study (min)"
              radius={[12, 12, 0, 0]}
              fill={`url(#${barFillId})`}
              fillOpacity={1}
              stroke={
                isDark
                  ? "rgba(255, 255, 255, 0.18)"
                  : "rgba(37, 99, 235, 0.35)"
              }
              strokeWidth={isDark ? 1 : 1.25}
              filter={`url(#${barShadowId})`}
              animationDuration={900}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="focus"
              name="Avg focus"
              stroke="var(--success)"
              strokeWidth={2.75}
              strokeOpacity={0.95}
              dot={{
                r: 4,
                fill: "var(--success)",
                strokeWidth: 0,
                fillOpacity: 0.95,
              }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              animationDuration={900}
            />
            <defs>
              {/* Glass bars: readable on light wells — bright cap, blue body, deeper base */}
              <linearGradient id={barFillId} x1="0" y1="0" x2="0" y2="1">
                {isDark ? (
                  <>
                    <stop offset="0%" stopColor="#f1f5f9" stopOpacity={0.42} />
                    <stop offset="35%" stopColor="#94a3b8" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.48} />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.98} />
                    <stop offset="28%" stopColor="#dbeafe" stopOpacity={0.82} />
                    <stop offset="72%" stopColor="#60a5fa" stopOpacity={0.68} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.58} />
                  </>
                )}
              </linearGradient>
              <filter
                id={barShadowId}
                x="-25%"
                y="-8%"
                width="150%"
                height="120%"
                filterUnits="objectBoundingBox"
              >
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="2.5"
                  floodColor={isDark ? "#000000" : "#1e3a8a"}
                  floodOpacity={isDark ? 0.35 : 0.14}
                />
              </filter>
            </defs>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
