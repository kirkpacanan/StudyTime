import type { FocusSensitivity } from "@/lib/types";

/** Fixed focus score at or above which a sample counts as "focused". */
export const SYSTEM_FOCUS_THRESHOLD = 70;

/** Fixed focus score below which a sample counts as "distracted". */
export const SYSTEM_DISTRACTION_THRESHOLD = 40;

/** Fixed sensitivity preset for all users (not user-configurable). */
export const SYSTEM_FOCUS_SENSITIVITY: FocusSensitivity = "balanced";

/** Fixed desk-work bias for head-down posture handling. */
export const SYSTEM_DESK_WORK_BIAS = true;
