"use client";

import { cn } from "@/lib/cn";
import { useId } from "react";

type StudyTimeLogoProps = {
  /** Pixel width/height of the mark */
  size?: number;
  className?: string;
  /** Visually hidden label for accessibility when used alone */
  "aria-label"?: string;
};

/**
 * Personalized StudyTime mark: open book (study) + golden orbit + live focus dot (monitoring).
 */
export function StudyTimeLogo({
  size = 40,
  className,
  "aria-label": ariaLabel = "StudyTime",
}: StudyTimeLogoProps) {
  const gid = useId().replace(/:/g, "");
  const gradId = `st-logo-grad-${gid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradId} x1="8%" y1="0%" x2="92%" y2="100%">
          <stop offset="0%" stopColor="#5B93FA" />
          <stop offset="50%" stopColor="#4F86F7" />
          <stop offset="100%" stopColor="#3A6FD4" />
        </linearGradient>
      </defs>

      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
      />

      {/* Golden orbit — rhythm of study sessions */}
      <path
        d="M 7 23.5 C 7 14.5 13.5 9 20 9 c 6.5 0 13 5.5 13 14.5"
        fill="none"
        stroke="#F6C453"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity={0.95}
      />

      {/* Live focus sensor */}
      <circle cx="31.5" cy="15.5" r="3.2" fill="#48BB78" stroke="#fff" strokeWidth="1" />

      {/* Open book pages */}
      <path
        d="M20 10.5v19.5c-2.8-.35-5.6-1.1-7.8-2.4-1.1-.65-2.1-1.45-2.9-2.35V12.9c.8-.45 1.7-.8 2.6-1.05 2.5-.7 5.2-.85 8.1-.35Z"
        fill="rgba(255,255,255,0.96)"
      />
      <path
        d="M20 10.5v19.5c2.8-.35 5.6-1.1 7.8-2.4 1.1-.65 2.1-1.45 2.9-2.35V12.9c-.8-.45-1.7-.8-2.6-1.05-2.5-.7-5.2-.85-8.1-.35Z"
        fill="rgba(255,255,255,0.88)"
      />
      <path
        d="M20 10.5v20"
        stroke="rgba(79,134,247,0.35)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
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
