"use client";

import type { DayAgg } from "@/lib/reports";
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

export function WeeklyFocusChart({ days }: { days: DayAgg[] }) {
  const data = days.map((d) => ({
    name: d.label,
    minutes: d.studyMinutes,
    focus: d.avgFocus ?? 0,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,134,247,0.12)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={{ stroke: "rgba(79,134,247,0.2)" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={{ stroke: "rgba(79,134,247,0.2)" }}
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
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={{ stroke: "rgba(79,134,247,0.2)" }}
            label={{
              value: "Avg focus %",
              angle: 90,
              position: "insideRight",
              style: { fill: "var(--muted)", fontSize: 11 },
            }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(79,134,247,0.15)",
              background: "var(--surface)",
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="minutes"
            name="Study (min)"
            radius={[6, 6, 0, 0]}
            fill="var(--primary)"
            fillOpacity={0.85}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="focus"
            name="Avg focus"
            stroke="var(--success)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--success)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
