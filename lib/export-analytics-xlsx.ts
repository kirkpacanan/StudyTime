// ExcelJS is ~400 KB — lazy-import it only when the user clicks "Download".
// This keeps it out of the initial reports bundle entirely.
import type ExcelJS from "exceljs";
import type {
  AnalyticsBundle,
  DateRange,
  Granularity,
  Insight,
} from "@/lib/analytics";
import {
  buildFocusDistribution,
  buildFocusTrend,
  formatHour,
  formatHourRange,
  formatMinutesOfDay,
  weekdayLong,
} from "@/lib/analytics";
import type { StudySession } from "@/lib/types";

/** StudyTime brand palette (matches app/globals.css light theme). */
const ST = {
  primary: "FF4F86F7",
  primarySoft: "FFE6EFFE",
  text: "FF1F2937",
  muted: "FF6B7280",
  success: "FF48BB78",
  successSoft: "FFECFDF3",
  alert: "FFF26A6A",
  alertSoft: "FFFEF2F2",
  accent: "FFF6C453",
  accentSoft: "FFFFFBEB",
  white: "FFFFFFFF",
  stripe: "FFF4F7FC",
  border: "FFD1D5DB",
} as const;

export type AnalyticsExportInput = {
  userName?: string;
  range: DateRange;
  streak: { current: number; longest: number };
  analytics: AnalyticsBundle;
  insights: Insight[];
  sessions: StudySession[];
  granularity: Granularity;
};

function borderThin(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: "thin", color: { argb: ST.border } };
  return { top: s, left: s, bottom: s, right: s };
}

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function styleTitle(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 18, bold: true, color: { argb: ST.white } };
  cell.fill = fill(ST.primary);
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

function styleSection(cell: ExcelJS.Cell, label: string) {
  cell.value = label;
  cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: ST.primary } };
  cell.fill = fill(ST.primarySoft);
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: ST.white } };
    cell.fill = fill(ST.primary);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = borderThin();
  });
  row.height = 22;
}

function styleDataRow(row: ExcelJS.Row, stripe: boolean) {
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, color: { argb: ST.text } };
    cell.fill = fill(stripe ? ST.stripe : ST.white);
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = borderThin();
  });
}

function styleMetricLabel(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 11, color: { argb: ST.muted } };
  cell.fill = fill(ST.white);
  cell.border = borderThin();
}

function styleMetricValue(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 14, bold: true, color: { argb: ST.text } };
  cell.fill = fill(ST.white);
  cell.border = borderThin();
  cell.alignment = { horizontal: "right" };
}

function applyFocusScoreStyle(cell: ExcelJS.Cell, score: number | null) {
  if (score == null || Number.isNaN(score)) return;
  if (score >= 80) {
    cell.fill = fill(ST.successSoft);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: ST.success } };
  } else if (score >= 60) {
    cell.fill = fill(ST.accentSoft);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFB45309" } };
  } else {
    cell.fill = fill(ST.alertSoft);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: ST.alert } };
  }
}

function formatPctDelta(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function formatDateRange(range: DateRange): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}

function addSummarySheet(
  wb: ExcelJS.Workbook,
  input: AnalyticsExportInput,
) {
  const ws = wb.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  ws.columns = [
    { width: 28 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
  ];

  ws.mergeCells("A1:D1");
  const title = ws.getCell("A1");
  title.value = "StudyTime — Study Analytics Report";
  styleTitle(title);
  ws.getRow(1).height = 36;

  ws.mergeCells("A2:D2");
  const sub = ws.getCell("A2");
  sub.value = [
    input.userName ? `Student: ${input.userName}` : null,
    `Period: ${formatDateRange(input.range)}`,
    `Generated: ${new Date().toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  sub.font = { name: "Calibri", size: 10, color: { argb: ST.muted } };
  sub.fill = fill(ST.stripe);
  ws.getRow(2).height = 20;

  let r = 4;
  ws.mergeCells(`A${r}:D${r}`);
  styleSection(ws.getCell(`A${r}`), "Performance overview");
  r++;

  const o = input.analytics.overview;
  const cmp = input.analytics.comparison;
  const metrics: [string, string, string | number | null | undefined, string][] = [
    ["Study hours", `${o.studyHours.toFixed(1)} h`, cmp?.studyHours, "up"],
    ["Average focus", `${Math.round(o.avgFocus)}%`, cmp?.avgFocus, "up"],
    ["Sessions completed", String(o.sessionCount), cmp?.sessionCount, "up"],
    ["Avg session length", `${Math.round(o.avgDurationMin)} min`, cmp?.avgDurationMin, "up"],
    ["Distraction events", String(o.totalDistractions), cmp?.totalDistractions, "down"],
    ["Days studied", String(o.daysStudied), cmp?.daysStudied, "up"],
    ["Consistency score", `${o.consistencyScore}%`, cmp?.consistencyScore, "up"],
    ["Current streak", `${input.streak.current} days`, null, "up"],
    ["Longest streak", `${input.streak.longest} days`, null, "up"],
  ];

  ws.getRow(r).values = ["Metric", "Current", "vs prior period", "Trend"];
  styleHeaderRow(ws.getRow(r));
  r++;

  metrics.forEach(([label, current, delta], i) => {
    const row = ws.getRow(r);
    row.values = [label, current, formatPctDelta(delta as number | null), ""];
    styleDataRow(row, i % 2 === 0);
    if (label.toLowerCase().includes("focus")) {
      applyFocusScoreStyle(row.getCell(2), o.avgFocus);
    }
    r++;
  });

  r += 1;
  ws.mergeCells(`A${r}:D${r}`);
  styleSection(ws.getCell(`A${r}`), "Focus distribution");
  r++;
  const dist = buildFocusDistribution(input.sessions);
  ws.getRow(r).values = ["Band", "Sessions", "Share", ""];
  styleHeaderRow(ws.getRow(r));
  r++;
  dist.forEach((d, i) => {
    const row = ws.getRow(r);
    row.values = [d.band, d.count, `${d.pct}%`, ""];
    styleDataRow(row, i % 2 === 0);
    r++;
  });
}

function addSessionsSheet(wb: ExcelJS.Workbook, sessions: StudySession[]) {
  const ws = wb.addWorksheet("Sessions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = [
    "Started",
    "Ended",
    "Focus (min)",
    "Break (min)",
    "Avg focus %",
    "Focused %",
    "Distractions",
    "Samples",
  ];
  ws.columns = headers.map((h) => ({
    width: h.includes("Started") || h.includes("Ended") ? 22 : 14,
    header: h,
  }));

  const headerRow = ws.getRow(1);
  headerRow.values = headers;
  styleHeaderRow(headerRow);

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  sorted.forEach((s, i) => {
    const row = ws.getRow(i + 2);
    row.values = [
      new Date(s.startedAt).toLocaleString(),
      new Date(s.endedAt).toLocaleString(),
      Math.round(s.focusMs / 60_000),
      Math.round(s.breakMs / 60_000),
      s.averageFocus,
      s.focusedRatio,
      s.distractionEvents,
      s.samples.length,
    ];
    styleDataRow(row, i % 2 === 0);
    applyFocusScoreStyle(row.getCell(5), s.averageFocus);
    row.getCell(6).numFmt = "0\\%";
    row.getCell(5).numFmt = "0\\%";
  });
}

function addTrendSheet(
  wb: ExcelJS.Workbook,
  sessions: StudySession[],
  granularity: Granularity,
) {
  const ws = wb.addWorksheet("Focus trend", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { width: 16, header: "Period" },
    { width: 14, header: "Avg focus %" },
    { width: 16, header: "Study minutes" },
    { width: 12, header: "Sessions" },
  ];

  const headerRow = ws.getRow(1);
  headerRow.values = ["Period", "Avg focus %", "Study minutes", "Sessions"];
  styleHeaderRow(headerRow);

  const trend = buildFocusTrend(sessions, granularity);
  trend.forEach((p, i) => {
    const row = ws.getRow(i + 2);
    row.values = [p.label, p.avgFocus, p.studyMinutes, p.sessions];
    styleDataRow(row, i % 2 === 0);
    if (p.avgFocus != null) applyFocusScoreStyle(row.getCell(2), p.avgFocus);
  });
}

function addPatternsSheet(wb: ExcelJS.Workbook, input: AnalyticsExportInput) {
  const ws = wb.addWorksheet("Study patterns");
  ws.columns = [{ width: 32 }, { width: 24 }];

  let r = 1;
  ws.mergeCells(`A${r}:B${r}`);
  styleSection(ws.getCell(`A${r}`), "When you study best");
  r++;

  const { patterns } = input.analytics;
  const rows: [string, string][] = [
    [
      "Best focus window",
      patterns.bestWindow
        ? formatHourRange(patterns.bestWindow.start, patterns.bestWindow.end) +
          ` (${patterns.bestWindow.avgFocus}% avg)`
        : "—",
    ],
    [
      "Most productive window",
      patterns.productiveWindow
        ? formatHourRange(
            patterns.productiveWindow.start,
            patterns.productiveWindow.end,
          ) + ` (${patterns.productiveWindow.minutes} min)`
        : "—",
    ],
    [
      "Best day of week",
      patterns.bestDay
        ? `${weekdayLong(patterns.bestDay.dow)} (${patterns.bestDay.avgFocus}% avg)`
        : "—",
    ],
    [
      "Typical session start",
      patterns.avgStartMinutes != null
        ? formatMinutesOfDay(patterns.avgStartMinutes)
        : "—",
    ],
  ];

  rows.forEach(([label, value], i) => {
    const row = ws.getRow(r);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    styleMetricLabel(row.getCell(1));
    styleMetricValue(row.getCell(2));
    row.getCell(2).alignment = { horizontal: "left" };
    if (i % 2 === 1) {
      row.getCell(1).fill = fill(ST.stripe);
      row.getCell(2).fill = fill(ST.stripe);
    }
    r++;
  });

  r += 1;
  ws.mergeCells(`A${r}:B${r}`);
  styleSection(ws.getCell(`A${r}`), "Focus by hour of day");
  r++;
  ws.getRow(r).values = ["Hour", "Avg focus %"];
  styleHeaderRow(ws.getRow(r));
  r++;

  patterns.hourlyFocus.forEach((focus, hour) => {
    if (focus == null) return;
    const row = ws.getRow(r);
    row.values = [formatHour(hour), focus];
    styleDataRow(row, r % 2 === 0);
    applyFocusScoreStyle(row.getCell(2), focus);
    r++;
  });
}

function addDistractionsSheet(wb: ExcelJS.Workbook, input: AnalyticsExportInput) {
  const ws = wb.addWorksheet("Distractions");
  const d = input.analytics.distractions;

  ws.columns = [{ width: 28 }, { width: 16 }];
  let r = 1;
  ws.mergeCells(`A${r}:B${r}`);
  styleSection(ws.getCell(`A${r}`), "Distraction summary");
  r++;

  const summary: [string, string | number][] = [
    ["Total distraction events", d.totalDistractions],
    ["Timestamped signals", d.totalSignals],
    ["Phone events", d.phoneEvents],
    ["Drowsiness-related events", d.drowsinessEvents],
    ["Phone share of signals", `${d.phonePct}%`],
    [
      "Peak distraction hour",
      d.mostCommonHour != null ? formatHour(d.mostCommonHour) : "—",
    ],
  ];

  summary.forEach(([label, val], i) => {
    const row = ws.getRow(r);
    row.getCell(1).value = label;
    row.getCell(2).value = val;
    styleMetricLabel(row.getCell(1));
    styleMetricValue(row.getCell(2));
    row.getCell(2).alignment = { horizontal: "left" };
    if (i % 2 === 1) {
      row.getCell(1).fill = fill(ST.stripe);
      row.getCell(2).fill = fill(ST.stripe);
    }
    r++;
  });

  r += 1;
  ws.mergeCells(`A${r}:B${r}`);
  styleSection(ws.getCell(`A${r}`), "Distractions by weekday");
  r++;
  ws.getRow(r).values = ["Day", "Events"];
  styleHeaderRow(ws.getRow(r));
  r++;

  d.byDay.forEach((count, dow) => {
    if (count === 0) return;
    const row = ws.getRow(r);
    row.values = [weekdayLong(dow), count];
    styleDataRow(row, r % 2 === 0);
    r++;
  });
}

function addInsightsSheet(wb: ExcelJS.Workbook, insights: Insight[]) {
  const ws = wb.addWorksheet("Insights", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { width: 12, header: "Tone" },
    { width: 72, header: "Insight" },
  ];

  const headerRow = ws.getRow(1);
  headerRow.values = ["Tone", "Insight"];
  styleHeaderRow(headerRow);

  insights.forEach((ins, i) => {
    const row = ws.getRow(i + 2);
    row.values = [ins.tone, ins.text];
    styleDataRow(row, i % 2 === 0);
    const toneCell = row.getCell(1);
    if (ins.tone === "positive") {
      toneCell.fill = fill(ST.successSoft);
      toneCell.font = { color: { argb: ST.success }, bold: true };
    } else if (ins.tone === "warning") {
      toneCell.fill = fill(ST.alertSoft);
      toneCell.font = { color: { argb: ST.alert }, bold: true };
    }
  });
}

export async function buildAnalyticsWorkbook(
  input: AnalyticsExportInput,
): Promise<ArrayBuffer> {
  // Dynamic import: ExcelJS is only loaded when the user actually exports.
  const { default: ExcelJSLib } = await import("exceljs");
  const wb = new ExcelJSLib.Workbook() as InstanceType<typeof ExcelJS.Workbook>;
  wb.creator = "StudyTime";
  wb.created = new Date();
  wb.modified = new Date();

  addSummarySheet(wb, input);
  addSessionsSheet(wb, input.sessions);
  addTrendSheet(wb, input.sessions, input.granularity);
  addPatternsSheet(wb, input);
  addDistractionsSheet(wb, input);
  addInsightsSheet(wb, input.insights);

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

export function downloadAnalyticsWorkbook(
  buffer: ArrayBuffer,
  filename?: string,
): void {
  const name =
    filename ??
    `studytime-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
