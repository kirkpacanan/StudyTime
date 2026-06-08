"use client";

import { useState, useCallback } from "react";
import { AvatarCreator } from "@readyplayerme/rpm-react-sdk";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";

type AvatarCreatorModalProps = {
  onAvatarSaved: (avatarUrl: string) => void;
  onSkip: () => void;
};

export function AvatarCreatorModal({ onAvatarSaved, onSkip }: AvatarCreatorModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarExported = useCallback(
    async (url: string) => {
      if (!url?.endsWith(".glb")) return;

      setSaving(true);
      setError(null);

      try {
        if (isSupabaseEnabled()) {
          const supabase = getSupabaseBrowser();
          const { error: dbError } = await supabase
            .from("profiles")
            .update({ avatar_url: url })
            .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
          if (dbError) throw dbError;
        }
        // Also persist locally as a fallback.
        try {
          localStorage.setItem("studytime_avatar_url", url);
        } catch {
          // ignore
        }
        onAvatarSaved(url);
      } catch (err) {
        setError("Could not save avatar. Please try again.");
        console.error("[AvatarCreator]", err);
      } finally {
        setSaving(false);
      }
    },
    [onAvatarSaved],
  );

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Create your avatar</h2>
            <p className="mt-1 text-sm text-slate-400">
              Customize your 3D avatar. It will appear in the virtual library.
            </p>
          </div>
          <button
            onClick={onSkip}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            Skip for now
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/40 border border-red-500/30 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {saving && (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <span className="animate-pulse">Saving your avatar…</span>
          </div>
        )}

        {!saving && (
          <div className="relative h-[480px] w-full overflow-hidden rounded-xl border border-white/10">
            <AvatarCreator
              subdomain="studytime"
              onAvatarExported={handleAvatarExported}
            />
          </div>
        )}

        <p className="text-center text-[11px] text-slate-500">
          Powered by Ready Player Me · Your avatar URL is saved to your profile
        </p>
      </div>
    </div>
  );
}
