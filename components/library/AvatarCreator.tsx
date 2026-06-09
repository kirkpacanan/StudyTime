"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalBackdrop, ModalRoot } from "@/components/ui/modal-portal";
import { cn } from "@/lib/cn";
import {
  BLOCKY_PRESETS,
  DEFAULT_BLOCKY_AVATAR,
  parseBlockyAvatar,
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
import { SESSION_EASE } from "@/lib/library/session-motion";
import { LibraryIconButton, LibraryPanelHeader } from "./SessionChrome";
import { BlockyAvatarPreview } from "./BlockyAvatarPreview";

type AvatarCreatorVariant = "app" | "library";

type AvatarCreatorProps = {
  onAvatarSaved: (avatarUrl: string) => void;
  onClose?: () => void;
  showSkip?: boolean;
  skipLabel?: string;
  title?: string;
  subtitle?: string;
  /** Saved blocky avatar string — pre-fills the editor when changing an existing avatar. */
  initialAvatarUrl?: string | null;
  /** `app` — profile / main shell glass. `library` — session overlay glass. */
  variant?: AvatarCreatorVariant;
};

function initialConfigFromUrl(url: string | null | undefined): BlockyAvatarConfig {
  return parseBlockyAvatar(url) ?? DEFAULT_BLOCKY_AVATAR;
}

const APP_EASE = [0.16, 1, 0.3, 1] as const;

function useCreatorStyles(variant: AvatarCreatorVariant) {
  const isLibrary = variant === "library";
  return {
    sectionLabel: isLibrary
      ? "library-text-label mb-2.5"
      : "mb-2.5 text-xs font-medium text-muted",
    pickerSelected: isLibrary
      ? "border-sky-400/60 bg-sky-500/15 ring-1 ring-sky-400/30 text-slate-100"
      : "border-primary/50 bg-primary-soft ring-1 ring-primary/25 text-text",
    pickerIdle: isLibrary
      ? "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
      : "border-[color:var(--cc-border)] bg-[color:var(--cc-fill)] text-muted hover:border-primary/30 hover:bg-[color:var(--cc-fill-hover)] hover:text-text",
    swatchSelected: isLibrary
      ? "scale-105 border-white ring-2 ring-sky-400/80"
      : "scale-105 border-text/80 ring-2 ring-primary/50",
    swatchIdle: isLibrary
      ? "border-white/20 hover:scale-105"
      : "border-black/10 hover:scale-105 dark:border-white/20",
    presetCard: isLibrary
      ? "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
      : "border-[color:var(--cc-border)] bg-[color:var(--cc-fill)] hover:border-primary/25 hover:bg-[color:var(--cc-fill-hover)]",
    presetLabel: isLibrary ? "text-slate-300" : "text-muted",
    animActive: isLibrary
      ? "bg-sky-500/90 text-white shadow-sm"
      : "bg-primary text-white shadow-sm",
    animIdle: isLibrary
      ? "text-slate-400 hover:text-slate-100"
      : "text-muted hover:text-text",
    hintBadge: isLibrary
      ? "border-white/10 bg-black/40 text-slate-400"
      : "border-[color:var(--cc-border)] bg-[color:var(--cc-fill)] text-muted",
    animPill: isLibrary
      ? "border-white/10 bg-black/50"
      : "border-[color:var(--cc-border)] bg-[color:var(--cc-fill)] shadow-soft dark:shadow-soft-dark",
    previewFrame: isLibrary
      ? "library-glass-panel overflow-hidden"
      : "glass-inset overflow-hidden",
    errorBanner: isLibrary
      ? "border-red-500/30 bg-red-950/50 text-red-200"
      : "border-alert/30 bg-alert/10 text-alert",
  };
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={className}>{children}</p>;
}

function ColorSwatches({
  label,
  colors,
  value,
  onChange,
  styles,
}: {
  label: string;
  colors: string[];
  value: string;
  onChange: (c: string) => void;
  styles: ReturnType<typeof useCreatorStyles>;
}) {
  return (
    <div>
      <SectionLabel className={styles.sectionLabel}>{label}</SectionLabel>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              "h-9 w-9 rounded-xl border-2 transition-all duration-200 ease-out active:scale-95",
              value === color ? styles.swatchSelected : styles.swatchIdle,
            )}
            style={{ backgroundColor: color }}
            aria-label={`${label} ${color}`}
            aria-pressed={value === color}
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
  styles,
}: {
  label: string;
  options: { id: T; label: string; emoji?: string }[];
  value: T;
  onChange: (id: T) => void;
  styles: ReturnType<typeof useCreatorStyles>;
}) {
  return (
    <div>
      <SectionLabel className={styles.sectionLabel}>{label}</SectionLabel>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition duration-200 ease-out active:scale-[0.98]",
              value === opt.id ? styles.pickerSelected : styles.pickerIdle,
            )}
          >
            {opt.emoji && <span className="text-lg leading-none">{opt.emoji}</span>}
            <span className="text-[10px] font-medium leading-tight">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PresetGrid({
  config,
  onSelect,
  styles,
}: {
  config: BlockyAvatarConfig;
  onSelect: (c: BlockyAvatarConfig) => void;
  styles: ReturnType<typeof useCreatorStyles>;
}) {
  return (
    <div>
      <SectionLabel className={styles.sectionLabel}>Quick presets</SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BLOCKY_PRESETS.map((preset) => {
          const isActive =
            preset.config.hairStyle === config.hairStyle &&
            preset.config.faceStyle === config.faceStyle &&
            preset.config.skin === config.skin &&
            preset.config.shirt === config.shirt &&
            preset.config.pants === config.pants &&
            preset.config.hairColor === config.hairColor;
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => onSelect(preset.config)}
              aria-pressed={isActive}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-2.5 transition duration-200 ease-out active:scale-[0.98]",
                isActive ? styles.pickerSelected : styles.presetCard,
              )}
            >
              <div className="flex h-9 w-full overflow-hidden rounded-lg ring-1 ring-inset ring-black/5 dark:ring-white/10">
                <div className="flex-1" style={{ background: preset.config.skin }} />
                <div className="flex-1" style={{ background: preset.config.shirt }} />
                <div className="flex-1" style={{ background: preset.config.hairColor }} />
                <div className="flex-1" style={{ background: preset.config.pants }} />
              </div>
              <span className={cn("text-[10px] font-medium", styles.presetLabel)}>
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AnimToggle({
  value,
  onChange,
  styles,
}: {
  value: "idle" | "walk" | "sit";
  onChange: (v: "idle" | "walk" | "sit") => void;
  styles: ReturnType<typeof useCreatorStyles>;
}) {
  return (
    <div
      className={cn(
        "flex gap-0.5 rounded-full border p-1 backdrop-blur-md",
        styles.animPill,
      )}
    >
      {(["idle", "walk", "sit"] as const).map((anim) => (
        <button
          key={anim}
          type="button"
          onClick={() => onChange(anim)}
          aria-pressed={value === anim}
          className={cn(
            "rounded-full px-3.5 py-1 text-xs font-medium capitalize transition duration-200",
            value === anim ? styles.animActive : styles.animIdle,
          )}
        >
          {anim}
        </button>
      ))}
    </div>
  );
}

function CreatorBody({
  config,
  setConfig,
  previewAnim,
  setPreviewAnim,
  variant,
  styles,
}: {
  config: BlockyAvatarConfig;
  setConfig: React.Dispatch<React.SetStateAction<BlockyAvatarConfig>>;
  previewAnim: "idle" | "walk" | "sit";
  setPreviewAnim: (v: "idle" | "walk" | "sit") => void;
  variant: AvatarCreatorVariant;
  styles: ReturnType<typeof useCreatorStyles>;
}) {
  const patch = (partial: Partial<BlockyAvatarConfig>) =>
    setConfig((c) => ({ ...c, ...partial }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <div
        className={cn(
          "relative flex min-h-[240px] shrink-0 flex-col sm:min-h-[300px] lg:min-h-0 lg:w-[44%] lg:flex-none",
          variant === "app"
            ? "border-b border-[color:var(--cc-border)] p-4 lg:border-b-0 lg:border-r"
            : "border-b border-white/[0.06] p-3 lg:border-b-0 lg:border-r lg:border-white/[0.06]",
        )}
      >
        <div className={cn("relative min-h-0 flex-1", styles.previewFrame)}>
          <BlockyAvatarPreview
            config={config}
            animState={previewAnim}
            variant={variant}
            className="h-full min-h-[220px] w-full sm:min-h-[280px]"
          />
          <p
            className={cn(
              "pointer-events-none absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm",
              styles.hintBadge,
            )}
          >
            Drag to rotate · Scroll to zoom
          </p>
        </div>
        <div className="mt-3 flex justify-center">
          <AnimToggle value={previewAnim} onChange={setPreviewAnim} styles={styles} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-lg space-y-6 p-5 sm:p-6">
          <PresetGrid config={config} onSelect={setConfig} styles={styles} />

          <StylePicker<HairStyle>
            label="Hair style"
            options={HAIR_STYLES}
            value={config.hairStyle}
            onChange={(hairStyle) => patch({ hairStyle })}
            styles={styles}
          />

          {config.hairStyle !== "none" && (
            <ColorSwatches
              label="Hair color"
              colors={HAIR_SWATCHES}
              value={config.hairColor}
              onChange={(hairColor) => patch({ hairColor })}
              styles={styles}
            />
          )}

          <StylePicker<FaceStyle>
            label="Face"
            options={FACE_STYLES}
            value={config.faceStyle}
            onChange={(faceStyle) => patch({ faceStyle })}
            styles={styles}
          />

          <ColorSwatches
            label="Skin"
            colors={SKIN_SWATCHES}
            value={config.skin}
            onChange={(skin) => patch({ skin })}
            styles={styles}
          />
          <ColorSwatches
            label="Shirt"
            colors={SHIRT_SWATCHES}
            value={config.shirt}
            onChange={(shirt) => patch({ shirt })}
            styles={styles}
          />
          <ColorSwatches
            label="Pants"
            colors={PANTS_SWATCHES}
            value={config.pants}
            onChange={(pants) => patch({ pants })}
            styles={styles}
          />
        </div>
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
  initialAvatarUrl = null,
  variant = "library",
}: AvatarCreatorProps) {
  const [config, setConfig] = useState(() => initialConfigFromUrl(initialAvatarUrl));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewAnim, setPreviewAnim] = useState<"idle" | "walk" | "sit">("idle");
  const reduce = useReducedMotion();
  const styles = useCreatorStyles(variant);
  const isLibrary = variant === "library";

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

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const saveButton = (
    <Button
      variant="primary"
      onClick={() => void handleSave()}
      disabled={saving}
      className={cn(
        "shrink-0",
        isLibrary && "min-w-[7.5rem] bg-sky-500/90 hover:bg-sky-400/90",
      )}
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      {saving ? "Saving…" : "Save avatar"}
    </Button>
  );

  const skipButton =
    showSkip && onClose ? (
      isLibrary ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
        >
          {skipLabel}
        </button>
      ) : (
        <Button variant="ghost" onClick={onClose} className="shrink-0 text-muted">
          {skipLabel}
        </Button>
      )
    ) : null;

  const closeButton = onClose ? (
    isLibrary ? (
      <LibraryIconButton label="Close avatar creator" onClick={onClose}>
        <X className="h-3.5 w-3.5" />
      </LibraryIconButton>
    ) : (
      <Button
        variant="ghost"
        onClick={onClose}
        aria-label="Close"
        className="h-9 w-9 shrink-0 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    )
  ) : null;

  const headerActions = showSkip ? null : closeButton;

  const libraryFooter = isLibrary ? (
    <div className="library-glass-footer flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
      {skipButton}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 transition duration-200 hover:bg-sky-500 active:scale-[0.98] disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        {saving ? "Saving…" : "Save avatar"}
      </button>
    </div>
  ) : null;

  const errorBanner = saveError ? (
    <div
      className={cn(
        "shrink-0 border-b px-4 py-2.5 text-sm",
        styles.errorBanner,
      )}
      role="alert"
    >
      {saveError}
    </div>
  ) : null;

  const body = (
    <CreatorBody
      config={config}
      setConfig={setConfig}
      previewAnim={previewAnim}
      setPreviewAnim={setPreviewAnim}
      variant={variant}
      styles={styles}
    />
  );

  if (isLibrary) {
    return (
      <ModalRoot>
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 backdrop-blur-md sm:p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: SESSION_EASE }}
        >
          <motion.div
            className="library-glass-modal flex max-h-[min(100dvh-1.5rem,820px)] w-full max-w-6xl flex-col"
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, ease: SESSION_EASE }}
          >
            <div className="h-1 shrink-0 bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-500" />
            <LibraryPanelHeader
              icon={<Sparkles className="h-4 w-4 shrink-0 text-sky-300" />}
              title={title}
              subtitle={subtitle}
              actions={headerActions}
            />
            {errorBanner}
            {body}
            {libraryFooter}
          </motion.div>
        </motion.div>
      </ModalRoot>
    );
  }

  return (
    <ModalRoot>
      <AnimatePresence>
        <motion.div
          key="avatar-creator-app"
          className="fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <ModalBackdrop label="Close avatar creator" onClick={onClose} />
          <motion.div
            className="glass-card relative z-10 flex max-h-[min(92dvh,820px)] w-full max-w-5xl flex-col overflow-hidden p-0"
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: APP_EASE }}
          >
            <div className="h-1 shrink-0 bg-gradient-to-r from-primary via-sky-500 to-primary" />
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color:var(--cc-border)] px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft ring-1 ring-primary/20">
                  <UserRound className="h-5 w-5 text-primary" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-text sm:text-2xl">
                    {title}
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {saveButton}
                {closeButton}
              </div>
            </div>
            {errorBanner}
            {body}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </ModalRoot>
  );
}
