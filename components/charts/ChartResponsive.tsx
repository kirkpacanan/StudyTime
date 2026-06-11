"use client";

import { useEffect, useState, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

type ChartResponsiveProps = {
  height: number | `${number}%`;
  children: ReactElement;
  className?: string;
};

/** Defers Recharts mount until after layout so ResponsiveContainer gets real dimensions. */
export function ChartResponsive({ height, children, className }: ChartResponsiveProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <div className={className ?? "h-full w-full min-w-0"} aria-hidden />;
  }

  return (
    <ResponsiveContainer width="100%" height={height} minWidth={0}>
      {children}
    </ResponsiveContainer>
  );
}
