"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Video, Minimize2, Maximize2, GripHorizontal, X } from "lucide-react";
import type { FocusFrameResult } from "@/lib/focus-detection";

const FocusCamera = dynamic(
  () => import("@/components/FocusCamera").then((m) => ({ default: m.FocusCamera })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[140px] items-center justify-center bg-black/40 text-slate-400 text-sm backdrop-blur-sm">
        Loading camera…
      </div>
    ),
  },
);

type FocusCameraPanelProps = {
  enabled: boolean;
  active: boolean;
  phoneDetectionEnabled: boolean;
  focusThreshold: number;
  distractionThreshold: number;
  onSample: (sample: FocusFrameResult) => void;
  onClose?: () => void;
};

export function FocusCameraPanel({
  enabled,
  active,
  phoneDetectionEnabled,
  focusThreshold,
  distractionThreshold,
  onSample,
  onClose,
}: FocusCameraPanelProps) {
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const panel = panelRef.current;
      if (!panel) return;
      const newX = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - dragOffset.current.y));
      setPos({ x: newX, y: newY });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className="library-glass-panel fixed z-[60] flex flex-col overflow-hidden"
      style={{
        left: pos.x,
        top: pos.y,
        width: minimized ? 220 : 300,
        transition: "width 0.2s ease",
      }}
    >
      {/* Drag handle / header */}
      <div
        className="library-glass-header flex cursor-grab items-center gap-2 px-3 py-2 active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <Video className="h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span className="flex-1 text-xs font-semibold text-slate-200">Live Vision</span>
        <button
          onClick={() => setMinimized((m) => !m)}
          className="rounded p-0.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={minimized ? "Expand camera" : "Minimize camera"}
        >
          {minimized ? (
            <Maximize2 className="h-3.5 w-3.5" />
          ) : (
            <Minimize2 className="h-3.5 w-3.5" />
          )}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-0.5 text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
            aria-label="Close camera panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Camera feed */}
      {!minimized && (
        <div className="overflow-hidden">
          <FocusCamera
            enabled={enabled}
            active={active}
            phoneDetectionEnabled={phoneDetectionEnabled}
            focusThreshold={focusThreshold}
            distractionThreshold={distractionThreshold}
            onSample={onSample}
            variant="glass"
          />
        </div>
      )}
    </div>
  );
}
