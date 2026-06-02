"use client";

import { Card } from "@/components/ui/card";
import { getMyProfile, updatePrivacySettings } from "@/lib/social/profile-service";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import {
  DEFAULT_PRIVACY,
  type PrivacySettings,
  type ProfileVisibility,
} from "@/lib/social/types";
import { useEffect, useState } from "react";

const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string; hint: string }[] = [
  { value: "public", label: "Public", hint: "Anyone can view your profile and stats." },
  { value: "friends", label: "Friends only", hint: "Only accepted friends see your stats." },
  { value: "private", label: "Private", hint: "Only identity is shown; stats hidden." },
];

const TOGGLES: { key: keyof PrivacySettings; label: string }[] = [
  { key: "showOnLeaderboard", label: "Show me on the leaderboard" },
  { key: "allowFriendRequests", label: "Allow friend requests" },
  { key: "showStudyStatus", label: "Share my live study status" },
  { key: "showActivityFeed", label: "Share my activity in friends' feeds" },
];

export function PrivacySettingsCard() {
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    void getMyProfile().then((p) => {
      if (p) setSettings(p.privacy);
      setLoaded(true);
    });
  }, []);

  if (!isSupabaseEnabled()) return null;

  const update = <K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K],
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await updatePrivacySettings(settings);
    setSaving(false);
    if (res.ok) {
      setSettings(res.profile.privacy);
      setSaved(true);
    } else {
      setError(res.error);
    }
  };

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-text">Privacy & visibility</h2>
        <p className="mt-1 text-xs text-muted">
          Control who can find you and what they can see.
        </p>
      </div>

      <fieldset className="space-y-2" disabled={!loaded}>
        <legend className="text-xs font-medium text-muted">Profile visibility</legend>
        {VISIBILITY_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/45 bg-white/30 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <input
              type="radio"
              name="visibility"
              checked={settings.profileVisibility === opt.value}
              onChange={() => update("profileVisibility", opt.value)}
              className="mt-0.5 h-4 w-4 text-primary focus:ring-primary"
            />
            <span>
              <span className="block text-sm font-medium text-text">{opt.label}</span>
              <span className="block text-xs text-muted">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-3">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex items-center gap-3 text-sm text-text">
            <input
              type="checkbox"
              checked={Boolean(settings[t.key])}
              onChange={(e) => update(t.key, e.target.checked as never)}
              disabled={!loaded}
              className="h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary"
            />
            {t.label}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !loaded}
          className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save privacy settings"}
        </button>
        {saved ? <span className="text-sm text-success">Saved.</span> : null}
        {error ? <span className="text-sm text-alert">{error}</span> : null}
      </div>
    </Card>
  );
}
