"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { CLASSIC_POMODORO_SETTINGS, type SessionTimerSettings } from "@/lib/types";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Coffee,
  Hash,
  Timer,
} from "lucide-react";

const DURATION_OPTIONS = [
  { label: "25m", value: 25 },
  { label: "50m", value: 50 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
];

const PRESET_VALUES = new Set(DURATION_OPTIONS.map((o) => o.value));

function isClassicPomodoro(timer: SessionTimerSettings): boolean {
  return (
    timer.focusMinutes === CLASSIC_POMODORO_SETTINGS.focusMinutes &&
    timer.shortBreakMinutes === CLASSIC_POMODORO_SETTINGS.shortBreakMinutes &&
    timer.longBreakMinutes === CLASSIC_POMODORO_SETTINGS.longBreakMinutes &&
    timer.longBreakEvery === CLASSIC_POMODORO_SETTINGS.longBreakEvery
  );
}

type SessionTimerConfigProps = {
  timer: SessionTimerSettings;
  onTimerChange: (patch: Partial<SessionTimerSettings>) => void;
};

export function SessionTimerConfig({
  timer,
  onTimerChange,
}: SessionTimerConfigProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const classicActive = isClassicPomodoro(timer);

  const customValue = PRESET_VALUES.has(timer.focusMinutes)
    ? ""
    : String(timer.focusMinutes);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onTimerChange({ ...CLASSIC_POMODORO_SETTINGS })}
          className={cn(
            "flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition",
            classicActive
              ? "game-lite-btn-gold !justify-center"
              : "game-lite-chip",
          )}
        >
          Classic 25 / 5 / 15
        </button>
        <button
          type="button"
          onClick={() => setHelpOpen((o) => !o)}
          className="game-lite-chip flex items-center justify-center gap-1 px-3"
          aria-expanded={helpOpen}
          aria-label="How Pomodoro works"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          {helpOpen ? (
            <ChevronUp className="h-3 w-3 opacity-70" />
          ) : (
            <ChevronDown className="h-3 w-3 opacity-70" />
          )}
        </button>
      </div>

      {helpOpen && (
        <div className="game-lite-inset !min-h-0 items-start px-3 py-2.5 text-[11px] leading-relaxed text-sky-200/60">
          Focus in rounds, rest briefly, then take a long break every few rounds.
          Classic: 25m work, 5m short break, 15m long break every 4 rounds.
        </div>
      )}

      <section className="game-lite-enter-panel space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="game-lite-label">Work interval</p>
          <input
            type="number"
            min={5}
            max={480}
            value={customValue}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 5) {
                onTimerChange({ focusMinutes: val });
              }
            }}
            placeholder="Custom"
            aria-label="Custom work interval minutes"
            className="game-lite-inset !min-h-[2rem] !w-[4.5rem] !flex-none !px-2 !py-1 text-center text-sm text-white placeholder:text-sky-200/35"
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {DURATION_OPTIONS.map((opt) => {
            const selected = timer.focusMinutes === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTimerChange({ focusMinutes: opt.value })}
                className={cn(
                  "game-lite-chip relative",
                  selected && "game-lite-chip-selected",
                )}
              >
                {selected && (
                  <Check className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-sky-400 text-[#0f2744]" />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="game-lite-enter-panel space-y-2.5">
        <p className="game-lite-label">Breaks</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="game-lite-field">
            <Coffee className="h-3.5 w-3.5 text-sky-400/70" />
            <span className="game-lite-label !text-[9px]">Short</span>
            <input
              type="number"
              min={1}
              max={60}
              aria-label="Short break minutes"
              className="game-lite-field-input"
              value={timer.shortBreakMinutes}
              onChange={(e) =>
                onTimerChange({ shortBreakMinutes: Number(e.target.value) || 5 })
              }
            />
            <span className="text-[9px] font-semibold text-sky-200/40">min</span>
          </label>

          <label className="game-lite-field">
            <Timer className="h-3.5 w-3.5 text-sky-400/70" />
            <span className="game-lite-label !text-[9px]">Long</span>
            <input
              type="number"
              min={1}
              max={60}
              aria-label="Long break minutes"
              className="game-lite-field-input"
              value={timer.longBreakMinutes}
              onChange={(e) =>
                onTimerChange({ longBreakMinutes: Number(e.target.value) || 15 })
              }
            />
            <span className="text-[9px] font-semibold text-sky-200/40">min</span>
          </label>

          <label className="game-lite-field">
            <Hash className="h-3.5 w-3.5 text-sky-400/70" />
            <span className="game-lite-label !text-[9px]">Every</span>
            <input
              type="number"
              min={1}
              max={10}
              aria-label="Long break every N focus rounds"
              className="game-lite-field-input"
              value={timer.longBreakEvery}
              onChange={(e) =>
                onTimerChange({ longBreakEvery: Number(e.target.value) || 4 })
              }
            />
            <span className="text-[9px] font-semibold text-sky-200/40">rnd</span>
          </label>
        </div>
      </section>
    </div>
  );
}
