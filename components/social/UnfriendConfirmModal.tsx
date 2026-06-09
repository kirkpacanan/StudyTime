"use client";

import { Button } from "@/components/ui/button";
import { ModalBackdrop, ModalRoot } from "@/components/ui/modal-portal";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { UserMinus } from "lucide-react";
import { useEffect } from "react";

const APP_EASE = [0.16, 1, 0.3, 1] as const;

export type UnfriendTarget = {
  userId: string;
  displayName: string;
  username?: string | null;
  publicUid?: string | null;
};

type UnfriendConfirmModalProps = {
  open: boolean;
  target: UnfriendTarget | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function UnfriendConfirmModal({
  open,
  target,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: UnfriendConfirmModalProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, busy, onCancel]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleLabel =
    target?.username != null && target.username !== ""
      ? `@${target.username}`
      : target?.publicUid ?? null;

  return (
    <ModalRoot>
      <AnimatePresence>
        {open && target ? (
          <motion.div
            key="unfriend-confirm-overlay"
            className="fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <ModalBackdrop
              label="Cancel unfriend"
              onClick={busy ? undefined : onCancel}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="unfriend-dialog-title"
              aria-describedby="unfriend-dialog-desc"
              className="glass-card relative z-10 w-full max-w-sm overflow-hidden p-0"
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.28, ease: APP_EASE }}
            >
              <div className="h-1 w-full bg-gradient-to-r from-alert via-rose-400 to-alert" />

              <div className="p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-alert/12 ring-1 ring-alert/20">
                    <UserMinus className="h-5 w-5 text-alert" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="unfriend-dialog-title"
                      className="text-base font-semibold tracking-tight text-text"
                    >
                      Remove friend?
                    </h2>
                    <p className="mt-0.5 truncate text-sm font-medium text-text">
                      {target.displayName}
                      {handleLabel ? (
                        <span className="font-normal text-muted"> · {handleLabel}</span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <p
                  id="unfriend-dialog-desc"
                  className="text-sm leading-relaxed text-muted"
                >
                  This will remove the friendship connection between you and{" "}
                  <span className="font-medium text-text">{target.displayName}</span>.
                  You will no longer appear on each other&apos;s friends list unless
                  you send a new request.
                </p>

                {error ? (
                  <p
                    className="mt-4 rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <div className="mt-5 flex gap-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={onCancel}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="flex-1"
                    onClick={onConfirm}
                    disabled={busy}
                  >
                    {busy ? "Removing…" : "Unfriend"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalRoot>
  );
}
