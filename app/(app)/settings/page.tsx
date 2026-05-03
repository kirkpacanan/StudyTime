"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { getSettings, saveSettings } from "@/lib/storage";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/types";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm(getSettings(user.id));
  }, [user]);

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function save() {
    if (!user) return;
    saveSettings(user.id, {
      ...form,
      focusMinutes: Math.max(5, Math.min(120, form.focusMinutes)),
      shortBreakMinutes: Math.max(1, Math.min(60, form.shortBreakMinutes)),
      longBreakMinutes: Math.max(1, Math.min(60, form.longBreakMinutes)),
      longBreakEvery: Math.max(1, Math.min(10, form.longBreakEvery)),
      focusThreshold: Math.max(50, Math.min(95, form.focusThreshold)),
      distractionThreshold: Math.max(5, Math.min(60, form.distractionThreshold)),
    });
    setSaved(true);
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
    update("notificationsEnabled", Notification.permission === "granted");
  }

  if (!user) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tune Pomodoro lengths, focus thresholds, and camera behavior.
        </p>
      </div>

      <Card className="space-y-5">
        <h2 className="text-sm font-semibold text-text">Pomodoro</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted">
            Focus length (minutes)
            <Input
              type="number"
              className="mt-1"
              value={form.focusMinutes}
              onChange={(e) =>
                update("focusMinutes", Number(e.target.value) || 25)
              }
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Short break (minutes)
            <Input
              type="number"
              className="mt-1"
              value={form.shortBreakMinutes}
              onChange={(e) =>
                update("shortBreakMinutes", Number(e.target.value) || 5)
              }
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Long break (minutes)
            <Input
              type="number"
              className="mt-1"
              value={form.longBreakMinutes}
              onChange={(e) =>
                update("longBreakMinutes", Number(e.target.value) || 15)
              }
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Long break every N focus blocks
            <Input
              type="number"
              className="mt-1"
              value={form.longBreakEvery}
              onChange={(e) =>
                update("longBreakEvery", Number(e.target.value) || 4)
              }
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-5">
        <h2 className="text-sm font-semibold text-text">Focus scoring</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted">
            Focused threshold (0–100)
            <Input
              type="number"
              className="mt-1"
              value={form.focusThreshold}
              onChange={(e) =>
                update("focusThreshold", Number(e.target.value) || 70)
              }
            />
          </label>
          <label className="text-xs font-medium text-muted">
            Distracted threshold (0–100)
            <Input
              type="number"
              className="mt-1"
              value={form.distractionThreshold}
              onChange={(e) =>
                update("distractionThreshold", Number(e.target.value) || 40)
              }
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          Higher thresholds are stricter. Keep distracted below focused.
        </p>
      </Card>

      <Card className="space-y-5">
        <h2 className="text-sm font-semibold text-text">Devices & nudges</h2>
        <label className="flex items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            checked={form.webcamEnabled}
            onChange={(e) => update("webcamEnabled", e.target.checked)}
            className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary"
          />
          Enable webcam focus detection
        </label>
        <label className="flex items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            checked={form.notificationsEnabled}
            onChange={(e) =>
              update("notificationsEnabled", e.target.checked)
            }
            className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary"
          />
          Browser notifications on phase changes
        </label>
        <Button type="button" variant="secondary" onClick={requestNotifications}>
          Request notification permission
        </Button>
        {typeof Notification !== "undefined" ? (
          <p className="text-xs text-muted">
            Permission: {Notification.permission}
          </p>
        ) : null}
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save}>
          Save settings
        </Button>
        {saved ? (
          <span className="text-sm text-success">Saved.</span>
        ) : null}
      </div>
    </div>
  );
}
