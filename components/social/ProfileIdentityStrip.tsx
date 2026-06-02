"use client";

import { getMyProfile, updateProfile } from "@/lib/social/profile-service";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import type { MyProfile } from "@/lib/social/types";
import { AtSign, Check, Copy, Link2, Pencil, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Identity strip for the owner's profile hero: shows @username and the short
 * public UID with copy actions, and lets the user claim/change their username.
 * Renders nothing in local/demo mode (no cloud identity).
 */
export function ProfileIdentityStrip() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"uid" | "link" | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    void getMyProfile().then(setProfile);
  }, []);

  if (!isSupabaseEnabled() || !profile) return null;

  const profileLink = `${typeof window !== "undefined" ? window.location.origin : ""}/u/${
    profile.username || profile.publicUid
  }`;

  const copy = async (text: string, which: "uid" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const startEdit = () => {
    setDraft(profile.username ?? "");
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await updateProfile({ username: draft.trim().toLowerCase() });
    setBusy(false);
    if (res.ok) {
      setProfile(res.profile);
      setEditing(false);
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-lg border border-white/45 bg-white/30 px-2 py-1 font-medium text-muted dark:border-white/10 dark:bg-white/[0.05]">
          <Users className="h-3 w-3" />
          {profile.friendCount} {profile.friendCount === 1 ? "friend" : "friends"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
      {editing ? (
        <div className="flex w-full flex-col gap-2 sm:max-w-xs">
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 items-center rounded-lg border border-white/45 bg-white/40 px-2 dark:border-white/15 dark:bg-white/[0.07]">
              <AtSign className="h-3.5 w-3.5 text-muted" />
              <input
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                maxLength={24}
                placeholder="username"
                className="w-full bg-transparent px-1.5 py-1.5 text-sm text-text placeholder:text-muted/60 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-primary p-1.5 text-white transition hover:opacity-90 disabled:opacity-50"
              aria-label="Save username"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-white/45 bg-white/30 p-1.5 text-text dark:border-white/10 dark:bg-white/[0.05]"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {error ? <p className="text-[11px] text-alert">{error}</p> : null}
          <p className="text-[10px] text-muted">3–24 chars: lowercase letters, numbers, underscore.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-white/45 bg-white/30 px-2 py-1 font-medium text-text transition hover:bg-white/50 dark:border-white/10 dark:bg-white/[0.05]"
          >
            <AtSign className="h-3 w-3 text-muted" />
            {profile.username ?? "set username"}
            <Pencil className="h-2.5 w-2.5 text-muted" />
          </button>
          <button
            type="button"
            onClick={() => void copy(profile.publicUid, "uid")}
            className="inline-flex items-center gap-1 rounded-lg border border-white/45 bg-white/30 px-2 py-1 font-mono font-medium text-text transition hover:bg-white/50 dark:border-white/10 dark:bg-white/[0.05]"
            title="Copy your StudyTime UID"
          >
            {copied === "uid" ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted" />
            )}
            {profile.publicUid}
          </button>
          <button
            type="button"
            onClick={() => void copy(profileLink, "link")}
            className="inline-flex items-center gap-1 rounded-lg border border-white/45 bg-white/30 px-2 py-1 font-medium text-muted transition hover:bg-white/50 hover:text-text dark:border-white/10 dark:bg-white/[0.05]"
            title="Copy public profile link"
          >
            {copied === "link" ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Link2 className="h-3 w-3" />
            )}
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
        </>
      )}
      </div>
    </div>
  );
}
