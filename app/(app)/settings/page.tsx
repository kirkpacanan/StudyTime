"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PrivacySettingsCard } from "@/components/social/PrivacySettingsCard";
import { useAuth } from "@/hooks/useAuth";
import { getUserPreferences, saveUserPreferences } from "@/lib/storage";
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "@/lib/types";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getUserPreferences(user.id).then((prefs) => {
      if (!cancelled) setForm(prefs);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save() {
    if (!user) return;
    await saveUserPreferences(user.id, form);
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
          Manage device preferences and privacy. Focus scoring is standardized for
          fair leaderboard rankings.
        </p>
      </div>

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
            checked={form.phoneDetectionEnabled}
            onChange={(e) => update("phoneDetectionEnabled", e.target.checked)}
            className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary"
          />
          Enable phone detection (webcam)
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

      <PrivacySettingsCard />
    </div>
  );
}
