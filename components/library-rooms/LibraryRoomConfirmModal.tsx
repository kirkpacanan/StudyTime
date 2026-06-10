"use client";

import { Button } from "@/components/ui/button";
import { ModalBackdrop, ModalRoot } from "@/components/ui/modal-portal";
import type { LibraryRoomWithRole } from "@/lib/library-rooms";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogOut, Trash2 } from "lucide-react";
import { useEffect } from "react";

const APP_EASE = [0.16, 1, 0.3, 1] as const;

export type LibraryRoomAction = "delete" | "leave";

type LibraryRoomConfirmModalProps = {
  open: boolean;
  action: LibraryRoomAction | null;
  room: LibraryRoomWithRole | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function LibraryRoomConfirmModal({
  open,
  action,
  room,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: LibraryRoomConfirmModalProps) {
  const reduce = useReducedMotion();
  const isDelete = action === "delete";

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

  return (
    <ModalRoot>
      <AnimatePresence>
        {open && action && room ? (
          <motion.div
            key="library-room-confirm-overlay"
            className="fixed inset-0 z-[250] flex min-h-[100dvh] w-full items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <ModalBackdrop
              label={isDelete ? "Cancel delete room" : "Cancel leave room"}
              onClick={busy ? undefined : onCancel}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="library-room-dialog-title"
              aria-describedby="library-room-dialog-desc"
              className="glass-card relative z-10 w-full max-w-sm overflow-hidden p-0"
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.28, ease: APP_EASE }}
            >
              <div
                className={
                  isDelete
                    ? "h-1 w-full bg-gradient-to-r from-alert via-rose-400 to-alert"
                    : "h-1 w-full bg-gradient-to-r from-primary via-sky-400 to-primary"
                }
              />

              <div className="p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div
                    className={
                      isDelete
                        ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-alert/12 ring-1 ring-alert/20"
                        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20"
                    }
                  >
                    {isDelete ? (
                      <Trash2 className="h-5 w-5 text-alert" />
                    ) : (
                      <LogOut className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="library-room-dialog-title"
                      className="text-base font-semibold tracking-tight text-text"
                    >
                      {isDelete ? "Delete room?" : "Leave room?"}
                    </h2>
                    <p className="mt-0.5 truncate text-sm font-medium text-text">
                      {room.name}
                    </p>
                  </div>
                </div>

                <p
                  id="library-room-dialog-desc"
                  className="text-sm leading-relaxed text-muted"
                >
                  {isDelete ? (
                    <>
                      This permanently removes{" "}
                      <span className="font-medium text-text">{room.name}</span> for
                      all members. They will no longer be able to enter this study
                      room.
                    </>
                  ) : (
                    <>
                      You will leave{" "}
                      <span className="font-medium text-text">{room.name}</span>. You
                      can rejoin later with the invite code if you still have it.
                    </>
                  )}
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
                    variant={isDelete ? "danger" : "primary"}
                    className="flex-1"
                    onClick={onConfirm}
                    disabled={busy}
                  >
                    {busy
                      ? isDelete
                        ? "Deleting…"
                        : "Leaving…"
                      : isDelete
                        ? "Delete"
                        : "Leave"}
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
