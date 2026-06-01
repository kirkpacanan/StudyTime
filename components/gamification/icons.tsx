"use client";

import type { AchievementIcon } from "@/lib/gamification/achievements";
import {
  Award,
  Calendar,
  Crown,
  Flame,
  type LucideIcon,
  Moon,
  Rocket,
  Snowflake,
  Sparkles,
  Sunrise,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  target: Target,
  flame: Flame,
  trophy: Trophy,
  moon: Moon,
  zap: Zap,
  crown: Crown,
  rocket: Rocket,
  users: Users,
  snowflake: Snowflake,
  calendar: Calendar,
  award: Award,
  sunrise: Sunrise,
};

export function achievementIcon(name: AchievementIcon): LucideIcon {
  return ICONS[name] ?? Sparkles;
}
