"use client";

import { useCallback, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  BLOCKY_PRESETS,
  DEFAULT_BLOCKY_AVATAR,
  FACE_STYLES,
  HAIR_STYLES,
  HAIR_SWATCHES,
  PANTS_SWATCHES,
  SHIRT_SWATCHES,
  SKIN_SWATCHES,
  serializeBlockyAvatar,
  type BlockyAvatarConfig,
  type FaceStyle,
  type HairStyle,
} from "@/lib/library/blocky-avatar";
import { persistAvatarUrl } from "@/lib/library/persist-avatar";
import { BlockyAvatarPreview } from "./BlockyAvatarPreview";

type AvatarCreatorProps = {
  onAvatarSaved: (avatarUrl: string) => void;
  onClose?: () => void;
  showSkip?: boolean;
  skipLabel?: string;
  title?: string;
  subtitle?: string;
};

function ColorSwatches({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              "h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110",
              value === color ? "border-white ring-2 ring-sky-400" : "border-white/20",
            )}
            style={{ backgroundColor: color }}
            aria-label={`${label} ${color}`}
          />
        ))}
      </div>
    </div>
  );
}

function StylePicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; emoji?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border py-2.5 transition",
              value === opt.id
                ? "border-sky-400/60 bg-sky-500/15 ring-1 ring-sky-400/30"
                : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10",
            )}
          >
            {opt.emoji && <span className="text-lg leading-none">{opt.emoji}</span>}
            <span className="text-[10px] font-medium text-slate-300">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AvatarCreator({
  onAvatarSaved,
  onClose,
  showSkip = false,
  skipLabel = "Skip for now",
  title = "Create your avatar",
  subtitle = "Customize your blocky character for the study library.",
}: AvatarCreatorProps) {
  const [config, setConfig] = useState<BlockyAvatarConfig>(DEFAULT_BLOCKY_AVATAR);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewAnim, setPreviewAnim] = useState<"idle" | "walk" | "sit">("idle");

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const serialized = serializeBlockyAvatar(config);
      await persistAvatarUrl(serialized);
      onAvatarSaved(serialized);
    } catch (err) {
      console.error("[AvatarCreator]", err);
      setSaveError("Could not save avatar. Please try again.");
      setSaving(false);
    }
  }, [config, onAvatarSaved]);

  const patch = (partial: Partial<BlockyAvatarConfig>) =>
    setConfig((c) => ({ ...c, ...partial }));

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0a0a12]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 py-3 backdrop-blur-md">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-white sm:text-lg">{title}</h2>
          <p className="truncate text-xs text-slate-400 sm:text-sm">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save avatar"}
          </button>
          {showSkip && onClose && (
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              {skipLabel}
            </button>
          )}
          {onClose && !showSkip && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="shrink-0 border-b border-red-500/30 bg-red-900/40 px-4 py-2 text-sm text-red-300">
          {saveError}
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* 3D preview — portrait framing on face */}
        <div className="relative min-h-[280px] flex-1 border-b border-white/10 sm:min-h-[340px] lg:min-h-0 lg:w-[42%] lg:flex-none lg:border-b-0 lg:border-r">
          <BlockyAvatarPreview config={config} animState={previewAnim} className="h-full w-full" />
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-md">
            {(["idle", "walk", "sit"] as const).map((anim) => (
              <button
                key={anim}
                type="button"
                onClick={() => setPreviewAnim(anim)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize transition",
                  previewAnim === anim
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {anim}
              </button>
            ))}
          </div>
          <p className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-slate-400 backdrop-blur-sm">
            Drag to rotate · Scroll to zoom
          </p>
        </div>

        {/* Customization panel */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-lg space-y-5">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Quick presets
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BLOCKY_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setConfig(preset.config)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2 transition hover:border-white/25 hover:bg-white/10"
                  >
                    <div className="flex h-8 w-full overflow-hidden rounded-md">
                      <div className="flex-1" style={{ background: preset.config.shirt }} />
                      <div className="flex-1" style={{ background: preset.config.hairColor }} />
                      <div className="flex-1" style={{ background: preset.config.pants }} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-300">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <StylePicker<HairStyle>
              label="Hair style"
              options={HAIR_STYLES}
              value={config.hairStyle}
              onChange={(hairStyle) => patch({ hairStyle })}
            />

            {config.hairStyle !== "none" && (
              <ColorSwatches
                label="Hair color"
                colors={HAIR_SWATCHES}
                value={config.hairColor}
                onChange={(hairColor) => patch({ hairColor })}
              />
            )}

            <StylePicker<FaceStyle>
              label="Face"
              options={FACE_STYLES}
              value={config.faceStyle}
              onChange={(faceStyle) => patch({ faceStyle })}
            />

            <ColorSwatches
              label="Skin"
              colors={SKIN_SWATCHES}
              value={config.skin}
              onChange={(skin) => patch({ skin })}
            />
            <ColorSwatches
              label="Shirt"
              colors={SHIRT_SWATCHES}
              value={config.shirt}
              onChange={(shirt) => patch({ shirt })}
            />
            <ColorSwatches
              label="Pants"
              colors={PANTS_SWATCHES}
              value={config.pants}
              onChange={(pants) => patch({ pants })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
