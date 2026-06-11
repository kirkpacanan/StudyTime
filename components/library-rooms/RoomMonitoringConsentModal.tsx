"use client";

import { acceptRoomMonitoringConsent } from "@/lib/room-monitoring";
import { Camera, Shield } from "lucide-react";
import { useState } from "react";

type RoomMonitoringConsentModalProps = {
  roomId: string;
  roomName: string;
  onAccepted: () => void;
  onDecline: () => void;
};

export function RoomMonitoringConsentModal({
  roomId,
  roomName,
  onAccepted,
  onDecline,
}: RoomMonitoringConsentModalProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleAccept() {
    setErr(null);
    setBusy(true);
    try {
      await acceptRoomMonitoringConsent(roomId);
      onAccepted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save consent.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className="game-lite-modal w-full max-w-md p-6"
        role="dialog"
        aria-labelledby="monitoring-consent-title"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="game-lite-icon !h-11 !w-11">
            <Shield className="h-5 w-5 text-sky-200" />
          </div>
          <div>
            <h2 id="monitoring-consent-title" className="text-lg font-bold text-text">
              Study monitoring
            </h2>
            <p className="text-xs text-muted">{roomName}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-muted">
          <p>
            This room&apos;s host can view your <strong className="text-text">live focus score</strong>{" "}
            and session analytics while you study here.
          </p>
          <ul className="list-inside list-disc space-y-1.5 pl-1">
            <li>Photos may be captured when you start a session, drift off-task, leave the camera, or use your phone.</li>
            <li>Only the room host can see these photos — not other members.</li>
            <li>You can leave the room at any time from the library lobby.</li>
          </ul>
          <p className="flex items-start gap-2 rounded-lg border border-[var(--cc-border)] bg-white/5 p-3 text-xs">
            <Camera className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            Webcam must stay enabled during study sessions in this room.
          </p>
        </div>

        {err ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {err}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="game-lite-btn-ghost flex-1 disabled:opacity-50"
          >
            Decline & leave
          </button>
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={busy}
            className="game-lite-btn-gold flex-1 disabled:opacity-50"
          >
            {busy ? "Saving…" : "I agree — join study room"}
          </button>
        </div>
      </div>
    </div>
  );
}
