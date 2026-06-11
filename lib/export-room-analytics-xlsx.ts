import type ExcelJS from "exceljs";
import type { LibraryRoomAnalyticsRow } from "@/lib/library-rooms";
import { snapshotEventLabel, type ActivityEventLogRow, type RoomMemberSessionRow } from "@/lib/room-monitoring";
import { sortByLastFirstName } from "@/lib/sort-display-name";

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

export type RoomAnalyticsExportInput = {
  roomName: string;
  exportedAt: string;
  members: LibraryRoomAnalyticsRow[];
  sessionsByUser: Record<string, RoomMemberSessionRow[]>;
  eventLogByUser?: Record<string, ActivityEventLogRow[]>;
};

function borderThin(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: "thin", color: { argb: ST.border } };
  return { top: s, left: s, bottom: s, right: s };
}

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function applyFocusScoreStyle(cell: ExcelJS.Cell, score: number | null) {
  if (score == null || Number.isNaN(score)) return;
  if (score >= 70) {
    cell.fill = fill(ST.successSoft);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: ST.success } };
  } else if (score >= 50) {
    cell.fill = fill(ST.accentSoft);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFB45309" } };
  } else {
    cell.fill = fill(ST.alertSoft);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: ST.alert } };
  }
}

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function exportRoomAnalyticsXlsx(input: RoomAnalyticsExportInput): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "StudyTime";
  wb.created = new Date();

  const summary = wb.addWorksheet("Member summary");
  summary.columns = [
    { width: 6 },
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
  ];

  const title = summary.addRow([`Room analytics — ${input.roomName}`]);
  title.getCell(1).font = { name: "Calibri", size: 16, bold: true, color: { argb: ST.white } };
  title.getCell(1).fill = fill(ST.primary);
  summary.mergeCells(1, 1, 1, 9);

  summary.addRow([`Exported ${input.exportedAt}`]);
  summary.addRow([]);

  const header = summary.addRow([
    "#",
    "Member (full name)",
    "Sessions",
    "Avg focus %",
    "Focus time",
    "Phone alerts",
    "Drift",
    "Off screen",
    "Low-focus sessions",
  ]);
  header.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: ST.white } };
    cell.fill = fill(ST.primary);
    cell.border = borderThin();
  });

  const sorted = sortByLastFirstName(input.members, (m) => m.user_name);

  sorted.forEach((m, i) => {
    const row = summary.addRow([
      i + 1,
      m.user_name,
      Number(m.session_count),
      Number(m.avg_focus),
      formatMs(Number(m.total_focus_ms)),
      Number(m.phone_events ?? 0),
      Number(m.drift_events ?? 0),
      Number(m.off_screen_events ?? 0),
      Number(m.low_focus_count),
    ]);
    row.eachCell((cell, col) => {
      cell.border = borderThin();
      cell.fill = fill(i % 2 === 0 ? ST.white : ST.stripe);
      if (col === 4) applyFocusScoreStyle(cell, Number(m.avg_focus));
    });
  });

  const sessionsSheet = wb.addWorksheet("Session breakdown");
  sessionsSheet.columns = [
    { width: 24 },
    { width: 20 },
    { width: 20 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
  ];

  const sHeader = sessionsSheet.addRow([
    "Member",
    "Started",
    "Ended",
    "Avg focus %",
    "Focus time",
    "Phone",
    "Drift",
    "Off screen",
    "Distractions",
  ]);
  sHeader.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: ST.white } };
    cell.fill = fill(ST.primary);
    cell.border = borderThin();
  });

  let stripe = 0;
  for (const m of sorted) {
    const sessions = input.sessionsByUser[m.user_id] ?? [];
    for (const s of sessions) {
      const row = sessionsSheet.addRow([
        m.user_name,
        new Date(s.started_at).toLocaleString(),
        new Date(s.ended_at).toLocaleString(),
        s.average_focus,
        formatMs(s.focus_ms),
        Number(s.phone_events),
        Number(s.drift_events),
        Number(s.off_screen_events),
        s.distraction_events,
      ]);
      row.eachCell((cell, col) => {
        cell.border = borderThin();
        cell.fill = fill(stripe % 2 === 0 ? ST.white : ST.stripe);
        if (col === 4) applyFocusScoreStyle(cell, s.average_focus);
      });
      stripe++;
    }
  }

  const eventSheet = wb.addWorksheet("Event log");
  eventSheet.columns = [
    { width: 6 },
    { width: 24 },
    { width: 22 },
    { width: 20 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
  ];

  const eHeader = eventSheet.addRow([
    "#",
    "Member",
    "Event type",
    "Timestamp",
    "Duration",
    "Webcam",
    "Screen",
  ]);
  eHeader.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: ST.white } };
    cell.fill = fill(ST.primary);
    cell.border = borderThin();
  });

  let eventStripe = 0;
  for (const m of sorted) {
    const events = input.eventLogByUser?.[m.user_id] ?? [];
    for (const ev of events) {
      const row = eventSheet.addRow([
        ev.event_index,
        m.user_name,
        snapshotEventLabel(ev.event_type as never),
        new Date(ev.occurred_at).toLocaleString(),
        ev.duration_ms != null ? `${Math.round(ev.duration_ms / 1000)}s` : "—",
        ev.webcam_storage_path ? "yes" : "no",
        ev.screen_storage_path ? "yes" : "no",
      ]);
      row.eachCell((cell) => {
        cell.border = borderThin();
        cell.fill = fill(eventStripe % 2 === 0 ? ST.white : ST.stripe);
      });
      eventStripe++;
    }
  }

  const legend = wb.addWorksheet("Legend");
  legend.addRow(["Focus color guide"]);
  legend.addRow(["Green (70%+)", "Focused"]);
  legend.addRow(["Yellow (50–69%)", "Needs attention"]);
  legend.addRow(["Red (<50%)", "Distracted / flagged"]);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadRoomAnalyticsBlob(blob: Blob, roomName: string) {
  const slug = roomName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "room";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `studytime-${slug}-analytics.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
