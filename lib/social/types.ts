/**
 * Shared types for the social layer: public identities, privacy settings,
 * friends, presence, activity feed, and notifications. These mirror the JSON
 * shapes returned by the Supabase RPCs in `supabase/migrations/2024060100*`.
 */

export type ProfileVisibility = "public" | "friends" | "private";

export type PrivacySettings = {
  profileVisibility: ProfileVisibility;
  showOnLeaderboard: boolean;
  allowFriendRequests: boolean;
  showStudyStatus: boolean;
  showActivityFeed: boolean;
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  profileVisibility: "friends",
  showOnLeaderboard: true,
  allowFriendRequests: true,
  showStudyStatus: true,
  showActivityFeed: true,
};

export type MyProfile = {
  userId: string;
  email: string;
  username: string | null;
  publicUid: string;
  displayName: string;
  memberSince: string;
  friendCount: number;
  privacy: PrivacySettings;
};

export type FriendRelationship =
  | "self"
  | "friend"
  | "pending_in"
  | "pending_out"
  | "blocked"
  | "blocked_by"
  | "none";

export type StudyBuddyCard = {
  buddyId: string;
  username: string | null;
  publicUid: string;
  displayName: string;
  avatarId: string | null;
  frameId: string | null;
  level: number;
  pairedSince: string;
};

export type PublicProfileLoadout = {
  avatarId: string;
  frameId: string;
  themeId: string;
  titleId: string | null;
  bio: string;
  status: string;
  pinnedBadges: string[];
};

export type PublicProfileCard = {
  userId: string;
  username: string | null;
  publicUid: string;
  displayName: string;
  memberSince: string;
  profileVisibility: ProfileVisibility;
  allowFriendRequests: boolean;
  loadout: PublicProfileLoadout;
  level: number;
  prestige: number;
  xp: number;
  relationship: FriendRelationship;
  friendCount: number;
  studyBuddy: StudyBuddyCard | null;
  visible: boolean;
  stats: {
    currentStreak: number;
    longestStreak: number;
    totalFocusHours: number;
    sessionsCount: number;
  } | null;
};

export type UserSearchResult = {
  userId: string;
  username: string | null;
  publicUid: string;
  displayName: string;
  avatarId: string | null;
  frameId: string | null;
  level: number;
  relationship: FriendRelationship;
};

export type PresenceStatus = "offline" | "online" | "studying";

export type Friend = {
  userId: string;
  username: string | null;
  publicUid: string;
  displayName: string;
  avatarId: string | null;
  frameId: string | null;
  level: number;
  currentStreak: number;
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null;
  friendsSince: string;
};

export type FriendRequest = {
  requestId: string;
  userId: string;
  username: string | null;
  publicUid: string;
  displayName: string;
  avatarId: string | null;
  frameId: string | null;
  level: number;
  createdAt: string;
};

export type ActivityVerb =
  | "session_completed"
  | "streak_milestone"
  | "achievement_unlocked"
  | "level_up"
  | "friend_request_accepted"
  | "buddy_paired"
  | "started_studying";

export type ActivityEvent = {
  id: string;
  actorId: string;
  username: string | null;
  publicUid: string;
  displayName: string;
  avatarId: string | null;
  frameId: string | null;
  verb: ActivityVerb;
  objectType: string | null;
  objectId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

/** Link to a user's public profile. Prefers username, falls back to UID. */
export function profileHref(handle: {
  username?: string | null;
  publicUid?: string | null;
}): string {
  const slug = handle.username || handle.publicUid;
  return slug ? `/u/${encodeURIComponent(slug)}` : "/leaderboard";
}
