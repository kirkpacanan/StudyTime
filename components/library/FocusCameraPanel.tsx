"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Video, Minimize2, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FocusFrameResult } from "@/lib/focus-detection";
import { LibraryIconButton, LibraryPanelHeader } from "./SessionChrome";

const FocusCamera = dynamic(
  () => import("@/components/FocusCamera").then((m) => ({ default: m.FocusCamera })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[140px] items-center justify-center bg-black/30 text-xs text-slate-400 backdrop-blur-sm">
        Loading camera…
      </div>
    ),
  },
);

const PANEL_W = 288;
const PANEL_W_MIN = 208;

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

  return (
    <div
      className="library-glass-panel pointer-events-auto flex flex-col overflow-hidden"
      style={{
        width: minimized ? PANEL_W_MIN : PANEL_W,
        transition: "width 0.2s ease",
      }}
    >
      <LibraryPanelHeader
        icon={<Video className="h-3 w-3 shrink-0 text-cyan-300/90" />}
        title="Live Vision"
        subtitle={
          minimized
            ? active
              ? "Tracking on (hidden)"
              : "Paused"
            : active
              ? "Tracking active"
              : "Paused"
        }
        actions={
          <>
            <LibraryIconButton
              label={minimized ? "Expand camera" : "Minimize camera"}
              onClick={() => setMinimized((m) => !m)}
            >
              {minimized ? (
                <Maximize2 className="h-3 w-3" />
              ) : (
                <Minimize2 className="h-3 w-3" />
              )}
            </LibraryIconButton>
            {onClose && (
              <LibraryIconButton label="Close camera panel" variant="danger" onClick={onClose}>
                <X className="h-3 w-3" />
              </LibraryIconButton>
            )}
          </>
        }
      />

      {/* Keep camera mounted when minimized — only hide the preview so tracking continues. */}
      <div
        className={cn(
          minimized
            ? "pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0"
            : "overflow-hidden",
        )}
        aria-hidden={minimized}
      >
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

      {minimized && enabled && active && (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          <span className="text-[10px] text-slate-400">Focus tracking still running</span>
        </div>
      )}
    </div>
  );
}
