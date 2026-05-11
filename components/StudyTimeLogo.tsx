"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";

const LOGO_SRC = "/studytime-logo.png";

type StudyTimeLogoProps = {
  /** Pixel width/height of the mark */
  size?: number;
  className?: string;
  /** Visually hidden label for accessibility when used alone */
  "aria-label"?: string;
};

/** StudyTime brand mark — raster logo from `public/studytime-logo.png`. */
export function StudyTimeLogo({
  size = 40,
  className,
  "aria-label": ariaLabel = "StudyTime",
}: StudyTimeLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt={ariaLabel}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      sizes={`${size}px`}
      priority={false}
    />
  );
}

type WordmarkProps = {
  className?: string;
  logoSize?: number;
  titleClassName?: string;
  taglineClassName?: string;
};

export function StudyTimeWordmark({
  className,
  logoSize = 40,
  titleClassName,
  taglineClassName,
}: WordmarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <StudyTimeLogo size={logoSize} />
      <div className="min-w-0 text-left leading-tight">
        <p
          className={cn(
            "font-semibold tracking-tight text-text text-base",
            titleClassName,
          )}
        >
          StudyTime
        </p>
        <p className={cn("text-xs text-muted", taglineClassName)}>
          Focus & performance
        </p>
      </div>
    </div>
  );
}
