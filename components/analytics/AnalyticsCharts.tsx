"use client";

import { useTheme } from "@/contexts/theme-context";
import type { DistributionSlice, TrendPoint } from "@/lib/analytics";
import { useMemo } from "react";
import { ChartResponsive } from "@/components/charts/ChartResponsive";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Shared axis/grid colours so every analytics chart matches the design system. */
function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return {
    isDark,
    grid: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(59, 130, 246, 0.12)",
    axis: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(59, 130, 246, 0.2)",
    tooltip: {
      borderRadius: 14,
      border: isDark
        ? "1px solid rgba(255,255,255,0.12)"
        : "1px solid rgba(255,255,255,0.65)",
      background: isDark ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.82)",
      boxShadow: isDark
        ? "0 12px 40px rgba(0,0,0,0.45)"
        : "0 8px 32px rgba(79,134,247,0.12)",
      backdropFilter: "blur(16px) saturate(1.6)",
    } as const,
  };
}

const EMPTY =
  "flex min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-slate-300/80 px-6 text-center text-sm text-muted dark:border-white/10";

// --------------------------------------------------------------------------- #
// Focus trend (area)
// --------------------------------------------------------------------------- #

export function FocusTrendChart({ data }: { data: TrendPoint[] }) {
  const t = useChartTheme();
  const series = useMemo(
    () => data.map((d) => ({ name: d.label, focus: d.avgFocus ?? 0 })),
    [data],
  );

  if (series.length === 0) {
    return <div className={EMPTY}>No focus data in this range yet.</div>;
  }

  return (
    <div className="h-[18rem] w-full">
      <ChartResponsive height="100%">
        <AreaChart data={series} margin={{ top: 10, right: 12, bottom: 6, left: 0 }}>
          <defs>
            <linearGradient id="focusTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 6" stroke={t.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: t.axis }}
            minTickGap={16}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: t.axis }}
            width={32}
          />
          <Tooltip
            contentStyle={t.tooltip}
            formatter={(v) => [`${v}%`, "Avg focus"]}
          />
          <Area
            type="monotone"
            dataKey="focus"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#focusTrendFill)"
            animationDuration={800}
          />
        </AreaChart>
      </ChartResponsive>
    </div>
  );
}

// --------------------------------------------------------------------------- #
// Focus distribution (donut)
// --------------------------------------------------------------------------- #

const BAND_COLORS: Record<string, string> = {
  High: "var(--success)",
  Medium: "var(--accent)",
  Low: "var(--alert)",
};

export function FocusDistributionChart({
  data,
}: {
  data: DistributionSlice[];
}) {
  const t = useChartTheme();
  const total = data.reduce((a, d) => a + d.count, 0);

  if (total === 0) {
    return <div className={EMPTY}>No sessions to categorize yet.</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[12rem] w-[12rem] shrink-0">
        <ChartResponsive height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="band"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.band} fill={BAND_COLORS[d.band]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={t.tooltip}
              formatter={(v, name) => [`${v} sessions`, name]}
            />
          </PieChart>
        </ChartResponsive>
      </div>
      <ul className="w-full space-y-2">
        {data.map((d) => (
          <li key={d.band} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-text">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ background: BAND_COLORS[d.band] }}
                aria-hidden
              />
              {d.band} focus
            </span>
            <span className="text-sm tabular-nums text-muted">
              {d.count} · {d.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------------------- #
// Distraction bars (by hour or by day)
// --------------------------------------------------------------------------- #

export function DistractionBarChart({
  data,
}: {
  data: { name: string; count: number }[];
}) {
  const t = useChartTheme();
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return <div className={EMPTY}>No distraction events recorded yet.</div>;
  }

  return (
    <div className="h-[16rem] w-full">
      <ChartResponsive height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, bottom: 6, left: 0 }}>
          <CartesianGrid strokeDasharray="4 6" stroke={t.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: t.axis }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: t.axis }}
            width={28}
          />
          <Tooltip
            cursor={{
              fill: t.isDark ? "rgba(255,255,255,0.06)" : "rgba(79,134,247,0.08)",
            }}
            contentStyle={t.tooltip}
            formatter={(v) => [`${v}`, "Distractions"]}
          />
          <Bar
            dataKey="count"
            fill="var(--alert)"
            fillOpacity={0.78}
            radius={[8, 8, 0, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ChartResponsive>
    </div>
  );
}
