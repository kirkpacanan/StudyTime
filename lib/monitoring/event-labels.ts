import type { EvidenceEventType } from "@/lib/types";

const LABELS: Record<EvidenceEventType, string> = {
  session_start: "Session start",
  phone_detected: "Phone detected",
  off_screen: "Off screen",
  drift: "Drifting",
  sleep_drowsy: "Sleep / drowsiness",
  multiple_faces: "Multiple faces",
  excessive_distraction: "Excessive distraction",
  tab_switch: "Tab / window switch",
};

const DESCRIPTIONS: Record<EvidenceEventType, string> = {
  session_start: "Participant started the activity session.",
  phone_detected: "A phone or mobile device was detected in the camera view.",
  off_screen: "Participant left the camera frame or was away from the desk.",
  drift: "Sustained looking away from the study task.",
  sleep_drowsy: "Eyes closed or drowsiness detected for an extended period.",
  multiple_faces: "More than one face detected in the camera view.",
  excessive_distraction: "Sustained distracted, away, or low-focus state.",
  tab_switch: "Browser tab hidden or window lost focus during the session.",
};

export function evidenceEventLabel(type: string): string {
  return LABELS[type as EvidenceEventType] ?? type.replace(/_/g, " ");
}

export function evidenceEventDescription(type: string): string {
  return DESCRIPTIONS[type as EvidenceEventType] ?? evidenceEventLabel(type);
}
