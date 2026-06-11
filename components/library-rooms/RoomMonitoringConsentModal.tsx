"use client";

import { acceptRoomMonitoringConsent } from "@/lib/room-monitoring";
import { requestScreenCapture } from "@/lib/monitoring/evidence-capture";
import { Camera, Monitor, Shield } from "lucide-react";
import { useState } from "react";

type RoomMonitoringConsentModalProps = {
  roomId: string;
  roomName: string;
  onAccepted: (screenGranted: boolean) => void;
  onDecline: () => void;
};

export function RoomMonitoringConsentModal({
  roomId,
  roomName,
  onAccepted,
  onDecline,
}: RoomMonitoringConsentModalProps) {
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [screenHint, setScreenHint] = useState<string | null>(null);

  async function handleAccept() {
    if (!agreed) {
      setErr("Please check the box to confirm you understand and agree.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const screenGranted = await requestScreenCapture();
      await acceptRoomMonitoringConsent(roomId, screenGranted);
      if (!screenGranted) {
        setScreenHint(
          "Screen share was not granted. You can retry when starting the activity — webcam-only evidence may be recorded if screen capture stays unavailable.",
        );
      }
      onAccepted(screenGranted);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save consent.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className="game-lite-modal w-full max-w-lg p-6"
        role="dialog"
        aria-labelledby="monitoring-consent-title"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="game-lite-icon !h-11 !w-11">
            <Shield className="h-5 w-5 text-sky-200" />
          </div>
          <div>
            <h2 id="monitoring-consent-title" className="text-lg font-bold text-text">
              Activity monitoring consent
            </h2>
            <p className="text-xs text-muted">{roomName}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-muted">
          <p>
            As an activity room participant, the host can review your session under the rules below.
            Evidence is visible to the <strong className="text-text">host only</strong>.
          </p>
          <ul className="list-inside list-disc space-y-1.5 pl-1">
            <li>
              <strong className="text-text">Webcam monitoring</strong> — live focus scoring and periodic
              webcam snapshots during violations.
            </li>
            <li>
              <strong className="text-text">Screen capture</strong> — paired screen images when events
              are logged (you will be prompted to share your screen).
            </li>
            <li>
              <strong className="text-text">Focus tracking</strong> — attention states such as drifting,
              drowsiness, and phone use.
            </li>
            <li>
              <strong className="text-text">Event logging</strong> — numbered chronological log with
              timestamps and durations.
            </li>
            <li>
              <strong className="text-text">Violation evidence</strong> — webcam + screen thumbnails
              linked to each logged event for host review.
            </li>
          </ul>
          <p className="flex items-start gap-2 rounded-lg border border-[var(--cc-border)] bg-white/5 p-3 text-xs">
            <Camera className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            Webcam must stay enabled during activity sessions. Screen share can be revoked in your
            browser at any time; some browsers may limit capture on mobile.
          </p>
          <p className="flex items-start gap-2 rounded-lg border border-[var(--cc-border)] bg-white/5 p-3 text-xs">
            <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
            Clicking accept will immediately prompt for screen sharing. If denied, you can retry when
            you press Start Activity.
          </p>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--cc-border)] bg-white/5 p-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-text">
            I understand and agree to webcam monitoring, screen capture, focus tracking, event logging,
            and host-only evidence review for this activity room.
          </span>
        </label>

        {screenHint ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {screenHint}
          </p>
        ) : null}

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
            {busy ? "Saving…" : "I agree — continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
