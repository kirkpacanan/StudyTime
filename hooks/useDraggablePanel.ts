"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  PANEL_LAYOUT_VERSION,
  PANEL_SIDE_INSET,
  PANEL_TOP_INSET,
  clampPanelPosition,
  getDefaultPanelPosition,
  panelDimensions,
  type PanelBounds,
  type PanelSlot,
} from "@/lib/library/panel-layout";

const STORAGE_PREFIX = "studytime-panel-pos";

function storageKey(panelId: PanelSlot): string {
  return `${STORAGE_PREFIX}:v${PANEL_LAYOUT_VERSION}:${panelId}`;
}

function readBounds(containerRef?: RefObject<HTMLElement | null>): PanelBounds | undefined {
  const el = containerRef?.current;
  if (!el || el.clientWidth < 100) return undefined;
  return { width: el.clientWidth, height: el.clientHeight };
}

function loadStoredPosition(panelId: PanelSlot, bounds: PanelBounds): { x: number; y: number } | null {
  try {
    const raw = sessionStorage.getItem(storageKey(panelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x: number; y: number };
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    const { w, h } = panelDimensions(panelId);
    return clampPanelPosition(parsed.x, parsed.y, w, h, bounds);
  } catch {
    return null;
  }
}

/** Remove any panel-position keys that belong to an older layout version. */
function pruneOldPanelStorage() {
  try {
    const stale: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (
        key?.startsWith("studytime-panel-pos:") &&
        !key.startsWith(`studytime-panel-pos:v${PANEL_LAYOUT_VERSION}:`)
      ) {
        stale.push(key);
      }
    }
    stale.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function useDraggablePanel(
  panelId: PanelSlot,
  containerRef?: RefObject<HTMLElement | null>,
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const userMovedRef = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: PANEL_SIDE_INSET, y: PANEL_TOP_INSET });

  const [pos, setPos] = useState({ x: PANEL_SIDE_INSET, y: PANEL_TOP_INSET });

  const getBounds = useCallback(
    () => readBounds(containerRef),
    [containerRef],
  );

  const clampToPanel = useCallback(
    (x: number, y: number) => {
      const panel = panelRef.current;
      const bounds = getBounds();
      const { w, h } = panelDimensions(
        panelId,
        panel?.offsetWidth,
        panel?.offsetHeight,
      );
      return clampPanelPosition(x, y, w, h, bounds);
    },
    [panelId, getBounds],
  );

  const applyPosition = useCallback(
    (next: { x: number; y: number }) => {
      const clamped = clampToPanel(next.x, next.y);
      posRef.current = clamped;
      setPos(clamped);
    },
    [clampToPanel],
  );

  const persist = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey(panelId), JSON.stringify(posRef.current));
    } catch {
      /* ignore */
    }
  }, [panelId]);

  const syncPosition = useCallback(() => {
    const bounds = readBounds(containerRef);
    if (!bounds) return;

    if (userMovedRef.current) {
      applyPosition(posRef.current);
      return;
    }

    const stored = loadStoredPosition(panelId, bounds);
    if (stored) {
      applyPosition(stored);
      return;
    }

    const container = containerRef?.current ?? null;
    applyPosition(getDefaultPanelPosition(panelId, bounds, container));
  }, [panelId, containerRef, applyPosition]);

  const pointerToLocal = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef?.current;
      if (!container) return { x: clientX, y: clientY };
      const rect = container.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [containerRef],
  );

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      dragging.current = true;
      userMovedRef.current = true;
      const local = pointerToLocal(e.clientX, e.clientY);
      dragOffset.current = {
        x: local.x - posRef.current.x,
        y: local.y - posRef.current.y,
      };
      e.preventDefault();
    },
    [pointerToLocal],
  );

  // Prune stale keys from older layout versions once on mount.
  useEffect(() => {
    pruneOldPanelStorage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    syncPosition();
  }, [syncPosition]);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(syncPosition);
    });
    ro.observe(el);

    if (panelId === "timer") {
      const focus = el.querySelector('[data-panel-slot="focus"]');
      if (focus) ro.observe(focus);
    }

    return () => ro.disconnect();
  }, [containerRef, panelId, syncPosition]);

  // Timer: re-slot under focus after it paints.
  useEffect(() => {
    if (panelId !== "timer" || userMovedRef.current) return;
    const t1 = requestAnimationFrame(() => syncPosition());
    const t2 = window.setTimeout(syncPosition, 80);
    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
    };
  }, [panelId, syncPosition]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const local = pointerToLocal(e.clientX, e.clientY);
      applyPosition({
        x: local.x - dragOffset.current.x,
        y: local.y - dragOffset.current.y,
      });
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      persist();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [applyPosition, persist, pointerToLocal]);

  return { panelRef, pos, onDragStart };
}
