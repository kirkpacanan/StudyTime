"use client";

import { cn } from "@/lib/cn";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalPortalProps = {
  children: ReactNode;
  className?: string;
  lockScroll?: boolean;
};

/** Portals children to `document.body` (use with AnimatePresence + motion overlays). */
export function ModalRoot({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}

/** Renders modal UI on `document.body` so overlays cover the full viewport. */
export function ModalPortal({
  children,
  className,
  lockScroll = true,
}: ModalPortalProps) {
  useEffect(() => {
    if (!lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockScroll]);

  return (
    <ModalRoot>
      <div
        className={cn(
          "fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center",
          className,
        )}
      >
        {children}
      </div>
    </ModalRoot>
  );
}

type ModalBackdropProps = ComponentProps<"button"> & {
  label?: string;
};

export function ModalBackdrop({
  className,
  label = "Close",
  type = "button",
  ...props
}: ModalBackdropProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "absolute inset-0 min-h-[100dvh] w-full border-0 bg-slate-950/60 backdrop-blur-xl backdrop-saturate-150 dark:bg-black/70",
        className,
      )}
      {...props}
    />
  );
}
