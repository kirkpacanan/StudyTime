"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/config";

/**
 * Ready Player Me iframe integration via postMessage.
 *
 * The RPM React SDK (@readyplayerme/rpm-react-sdk) bundles its own copy of
 * React inside @readyplayerme/visage, which causes a dual-React-instance crash
 * when used alongside @react-three/fiber. We bypass the SDK and talk directly
 * to the RPM hosted iframe using the postMessage API — the same mechanism the
 * SDK uses internally.
 *
 * Docs: https://docs.readyplayer.me/ready-player-me/integration-guides/web-and-webview/iframe
 */

const RPM_SUBDOMAIN = "studytime";
const RPM_CREATOR_URL = `https://${RPM_SUBDOMAIN}.readyplayer.me/avatar?frameApi&clearCache`;

type AvatarCreatorModalProps = {
  onAvatarSaved: (avatarUrl: string) => void;
  onSkip: () => void;
};

export function AvatarCreatorModal({ onAvatarSaved, onSkip }: AvatarCreatorModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      // Only accept messages from the RPM domain.
      if (!event.origin.includes("readyplayer.me")) return;

      let data: Record<string, unknown>;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      // RPM sends { eventName: "v1.frame.ready" } when the iframe is loaded.
      if (data.eventName === "v1.frame.ready") {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ target: "readyplayerme", type: "subscribe", eventName: "v1.avatar.exported" }),
          "*",
        );
        return;
      }

      // RPM sends { eventName: "v1.avatar.exported", data: { url: "https://..." } }
      if (data.eventName === "v1.avatar.exported") {
        const payload = data.data as Record<string, unknown> | undefined;
        const url = (payload?.url as string) ?? (data.url as string);
        if (!url?.endsWith(".glb")) return;
        await persistAvatar(url);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onAvatarSaved],
  );

  async function persistAvatar(url: string) {
    setSaving(true);
    setError(null);
    try {
      if (isSupabaseEnabled()) {
        const supabase = getSupabaseBrowser();
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { error: dbError } = await supabase
            .from("profiles")
            .update({ avatar_url: url })
            .eq("id", userData.user.id);
          if (dbError) throw dbError;
        }
      }
      try { localStorage.setItem("studytime_avatar_url", url); } catch { /* ignore */ }
      onAvatarSaved(url);
    } catch (err) {
      setError("Could not save avatar. Please try again.");
      console.error("[AvatarCreator]", err);
      setSaving(false);
    }
  }

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Create your avatar</h2>
            <p className="mt-1 text-sm text-slate-400">
              Customize your 3D avatar — it will appear in the virtual library.
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

        {saving ? (
          <div className="flex h-[480px] items-center justify-center text-slate-400">
            <span className="animate-pulse">Saving your avatar…</span>
          </div>
        ) : (
          <div className="relative h-[480px] w-full overflow-hidden rounded-xl border border-white/10 bg-slate-800">
            <iframe
              ref={iframeRef}
              src={RPM_CREATOR_URL}
              title="Ready Player Me Avatar Creator"
              allow="camera *; microphone *"
              className="h-full w-full border-0"
            />
          </div>
        )}

        <p className="text-center text-[11px] text-slate-500">
          Powered by Ready Player Me · Your avatar is saved to your profile
        </p>
      </div>
    </div>
  );
}
