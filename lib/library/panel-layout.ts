/** Bump when default panel slots change — clears stale sessionStorage positions. */
export const PANEL_LAYOUT_VERSION = 8;

export const PANEL_SIDE_INSET = 16;
/** Aligned with the session top bar (pt-4 = 16px). */
export const PANEL_TOP_INSET = 16;
export const PANEL_COLUMN_GAP = 12;
export const PANEL_MIN_Y = 8;
/**
 * Extra right margin so the right-column panels (focus/timer) start
 * to the LEFT of the exit button glass pill in the top bar.
 * Exit button is ~100 px wide + 16 px px-4 margin on the right.
 */
export const PANEL_EXIT_RESERVE = 100;

export type PanelSlot = "camera" | "focus" | "timer";

export type PanelBounds = { width: number; height: number };

export type PanelLayout = Record<PanelSlot, { x: number; y: number }>;

/** Exported widths — keep in sync with panel components. */
export const PANEL_WIDTHS: Record<PanelSlot, number> = {
  camera: 288,
  focus: 196,
  timer: 176,
};

/** Fallback heights before DOM measure (expanded focus + timer). */
export const PANEL_HEIGHT_EST: Record<PanelSlot, number> = {
  camera: 300,
  focus: 268,
  timer: 200,
};

function resolveBounds(bounds?: PanelBounds): PanelBounds | null {
  if (bounds && bounds.width > 0 && bounds.height > 0) return bounds;
  return null;
}

function rightX(width: number, panelW: number): number {
  return Math.max(PANEL_SIDE_INSET, width - panelW - PANEL_SIDE_INSET - PANEL_EXIT_RESERVE);
}

/** Timer sits on the right column, directly under the focus panel. */
export function resolveTimerPosition(
  bounds: PanelBounds,
  container?: HTMLElement | null,
): { x: number; y: number } {
  const x = rightX(bounds.width, PANEL_WIDTHS.timer);
  const timerH = PANEL_HEIGHT_EST.timer;

  if (container) {
    const focus = container.querySelector('[data-panel-slot="focus"]') as HTMLElement | null;
    if (focus && focus.offsetHeight >= 40) {
      const y = focus.offsetTop + focus.offsetHeight + PANEL_COLUMN_GAP;
      return { x, y: Math.min(y, bounds.height - timerH - PANEL_SIDE_INSET) };
    }
  }

  const y = PANEL_TOP_INSET + PANEL_HEIGHT_EST.focus + PANEL_COLUMN_GAP;
  return { x, y: Math.min(y, bounds.height - timerH - PANEL_SIDE_INSET) };
}

/**
 * Default layout:
 * - Live Vision: top-left
 * - Focus: top-right (higher)
 * - Timer: right column, snug under focus
 */
export function computeSessionPanelLayout(
  bounds: PanelBounds,
  container?: HTMLElement | null,
): PanelLayout {
  const top = PANEL_TOP_INSET;

  return {
    camera: { x: PANEL_SIDE_INSET, y: top },
    focus: { x: rightX(bounds.width, PANEL_WIDTHS.focus), y: top },
    timer: resolveTimerPosition(bounds, container),
  };
}

export function getDefaultPanelPosition(
  slot: PanelSlot,
  bounds?: PanelBounds,
  container?: HTMLElement | null,
): { x: number; y: number } {
  const resolved = resolveBounds(bounds);
  if (!resolved) {
    return { x: PANEL_SIDE_INSET, y: PANEL_TOP_INSET };
  }
  return computeSessionPanelLayout(resolved, container)[slot];
}

export function panelDimensions(
  panelId: PanelSlot,
  measuredW?: number,
  measuredH?: number,
): { w: number; h: number } {
  return {
    w: measuredW && measuredW > 8 ? measuredW : PANEL_WIDTHS[panelId],
    h: measuredH && measuredH > 8 ? measuredH : PANEL_HEIGHT_EST[panelId],
  };
}

export function clampPanelPosition(
  x: number,
  y: number,
  panelW: number,
  panelH: number,
  bounds?: PanelBounds,
): { x: number; y: number } {
  const resolved = resolveBounds(bounds);
  if (!resolved) return { x, y };
  const w = panelW > 0 ? panelW : 1;
  const h = panelH > 0 ? panelH : 1;
  const { width, height } = resolved;
  const maxX = Math.max(0, width - w);
  const maxY = Math.max(0, height - h);
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(PANEL_MIN_Y, Math.min(maxY, y)),
  };
}
