import { create } from "zustand";
import { ALL_MISSIONS_BONUS_XP, generateDailyMissions, Mission, todayDateStr } from "./missions";
import { fetchCustomerInfo, hasProEntitlement } from "./purchases";
import { supabase } from "./supabase";

export interface Dog {
  id: string;
  name: string;
  breed: string;
  age: string;
  level: number;
  total_xp: number;
  streak_days: number;
  last_trained_at?: string;
  experience?: string;
  owner_id?: string;
  gender?: string;
  birthday?: string;
  training_goals?: string[];
  known_skills?: string[];
  daily_minutes?: number;
  preferred_time?: string;
  track_health?: boolean;
  lifestyle?: string[];
  has_coparent?: boolean;
  active_program_slugs?: string[];
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  trigger_type: string;
  trigger_value: number;
  rarity: string;
  xp_reward: number;
  sort_order: number;
}

export interface EarnedBadge {
  badge_id: string;
  earned_at: string;
}

// Single source of truth for the level table.
// Used everywhere XP is added or displayed. Don't inline this anywhere else.
export const LEVELS = [
  { level: 1, minXP: 0,    title: "Curious Pup" },
  { level: 2, minXP: 200,  title: "Learning Tail" },
  { level: 3, minXP: 500,  title: "Good Boy/Girl" },
  { level: 4, minXP: 1000, title: "Focused Paw" },
  { level: 5, minXP: 2000, title: "Training Pro" },
  { level: 6, minXP: 3500, title: "Top Dog" },
] as const;

// Compute the level for a given XP total. Always use this when writing
// `level` to the dogs table — never inline the comparisons.
export function computeLevel(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i].level;
  }
  return 1;
}

export function getLevelInfo(xp: number): {
  level: number;
  title: string;
  currentLevelXP: number;
  nextLevelXP: number;
} {
  const current = [...LEVELS].reverse().find((l) => xp >= l.minXP) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.minXP > xp);
  return {
    level: current.level,
    title: current.title,
    currentLevelXP: current.minXP,
    // For max level, treat next as current so progress bar stays full
    nextLevelXP: next?.minXP ?? current.minXP,
  };
}

export function getStreakStatus(
  lastTrainedAt?: string,
): "active" | "at_risk" | "broken" {
  if (!lastTrainedAt) return "broken";
  const last = new Date(lastTrainedAt);
  const now = new Date();
  const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
  if (diffHours < 24) return "active";
  if (diffHours < 48) return "at_risk";
  return "broken";
}

const RARITY_COLORS: Record<string, string> = {
  common: "#9CA3AF",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#F59E0B",
};

export function getRarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
}

interface AppState {
  userId: string | null;
  dog: Dog | null;
  completedMissions: string[];
  allBadges: Badge[];
  earnedBadgeIds: string[];
  newlyEarnedBadges: Badge[];
  setUserId: (id: string | null) => void;
  setDog: (dog: Dog | null) => void;
  addCompletedMission: (id: string) => void;
  removeCompletedMission: (id: string) => void;
  resetMissions: () => void;
  loadCompletedTricks: (dogId: string) => Promise<void>;
  syncCompletedTrick: (dogId: string, trickId: string) => Promise<void>;
  unsyncCompletedTrick: (dogId: string, trickId: string) => Promise<void>;
  recalculateStreak: (dogId: string) => Promise<void>;
  loadBadges: (dogId: string) => Promise<void>;
  checkAndAwardBadges: (dogId: string) => Promise<Badge[]>;
  recheckAndRevokeBadges: (dogId: string) => Promise<void>;
  clearNewlyEarned: () => void;
  // Daily missions
  dailyMissions: Mission[];
  completedDailyIds: string[];
  allDailyDone: boolean;
  loadDailyMissions: (dogId: string) => Promise<void>;
  completeDailyMission: (dogId: string, missionId: string) => Promise<void>;
  undoDailyMission: (dogId: string, missionId: string) => Promise<void>;
  // Pro / RevenueCat
  isPro: boolean;
  loadProStatus: () => Promise<void>;
  setProForDev: (value: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  userId: null,
  dog: null,
  completedMissions: [],
  allBadges: [],
  earnedBadgeIds: [],
  newlyEarnedBadges: [],
  setUserId: (id) => set({ userId: id }),
  setDog: (dog) => set({ dog }),

  addCompletedMission: (id) =>
    set((state) => ({
      completedMissions: state.completedMissions.includes(id)
        ? state.completedMissions
        : [...state.completedMissions, id],
    })),

  removeCompletedMission: (id) =>
    set((state) => ({
      completedMissions: state.completedMissions.filter((m) => m !== id),
    })),

  resetMissions: () => set({ completedMissions: [] }),

  loadCompletedTricks: async (dogId: string) => {
    try {
      const { data } = await supabase
        .from("completed_tricks")
        .select("trick_id")
        .eq("dog_id", dogId);
      if (data) {
        set({ completedMissions: data.map((r) => r.trick_id) });
      }
    } catch (err) {
      console.error(err);
    }
  },

  syncCompletedTrick: async (dogId: string, trickId: string) => {
    get().addCompletedMission(trickId);
    try {
      await supabase.from("completed_tricks").upsert(
        { dog_id: dogId, trick_id: trickId },
        { onConflict: "dog_id,trick_id" },
      );
    } catch (err) {
      console.error(err);
    }
  },

  unsyncCompletedTrick: async (dogId: string, trickId: string) => {
    get().removeCompletedMission(trickId);
    try {
      await supabase
        .from("completed_tricks")
        .delete()
        .eq("dog_id", dogId)
        .eq("trick_id", trickId);
    } catch (err) {
      console.error(err);
    }
  },

  // ── Badge functions ──

  loadBadges: async (dogId: string) => {
    try {
      const [{ data: allBadges }, { data: earned }] = await Promise.all([
        supabase.from("badges").select("*").order("sort_order"),
        supabase.from("earned_badges").select("badge_id, earned_at").eq("dog_id", dogId),
      ]);
      set({
        allBadges: allBadges ?? [],
        earnedBadgeIds: (earned ?? []).map((e) => e.badge_id),
      });
    } catch (err) {
      console.error(err);
    }
  },

  checkAndAwardBadges: async (dogId: string) => {
    const { allBadges, earnedBadgeIds, dog, completedMissions } = get();
    if (!dog || allBadges.length === 0) return [];

    // Get session count
    const { count: sessionCount } = await supabase
      .from("training_sessions")
      .select("*", { count: "exact", head: true })
      .eq("dog_id", dogId);

    // Also count trick sessions (completed tricks count as sessions too)
    const totalSessions = (sessionCount ?? 0) + completedMissions.length;
    const trickCount = completedMissions.length;

    const newBadges: Badge[] = [];

    for (const badge of allBadges) {
      if (earnedBadgeIds.includes(badge.id)) continue;

      let earned = false;
      switch (badge.trigger_type) {
        case "session_count":
          earned = totalSessions >= badge.trigger_value;
          break;
        case "streak_days":
          earned = dog.streak_days >= badge.trigger_value;
          break;
        case "trick_count":
          earned = trickCount >= badge.trigger_value;
          break;
        case "level_reach":
          earned = dog.level >= badge.trigger_value;
          break;
        case "xp_total":
          earned = dog.total_xp >= badge.trigger_value;
          break;
      }

      if (earned) {
        try {
          await supabase.from("earned_badges").insert({
            dog_id: dogId,
            badge_id: badge.id,
          });
          newBadges.push(badge);
        } catch {
          // Already earned (unique constraint), skip
        }
      }
    }

    if (newBadges.length > 0) {
      // Award bonus XP for badges
      const bonusXP = newBadges.reduce((sum, b) => sum + b.xp_reward, 0);
      if (bonusXP > 0) {
        // Re-fetch dog to avoid clobbering XP added by concurrent calls
        // (e.g. session XP just got written by session.tsx)
        const { data: freshDog } = await supabase
          .from("dogs")
          .select("*")
          .eq("id", dogId)
          .single();
        const baseXP = freshDog?.total_xp ?? dog.total_xp;
        const newXP = baseXP + bonusXP;
        const newLevel = computeLevel(newXP);
        const { data } = await supabase
          .from("dogs")
          .update({ total_xp: newXP, level: newLevel })
          .eq("id", dogId)
          .select()
          .single();
        if (data) set({ dog: data });

        await supabase.from("xp_events").insert({
          dog_id: dogId,
          amount: bonusXP,
          reason: `Badge rewards: ${newBadges.map((b) => b.name).join(", ")}`,
        });
      }

      set((state) => ({
        earnedBadgeIds: [...state.earnedBadgeIds, ...newBadges.map((b) => b.id)],
        newlyEarnedBadges: newBadges,
      }));
    }

    return newBadges;
  },

  recheckAndRevokeBadges: async (dogId: string) => {
    // Fetch fresh data from Supabase to avoid stale state
    const [{ data: freshDog }, { data: freshTricks }, { count: sessionCount }] = await Promise.all([
      supabase.from("dogs").select("*").eq("id", dogId).single(),
      supabase.from("completed_tricks").select("trick_id").eq("dog_id", dogId),
      supabase.from("training_sessions").select("*", { count: "exact", head: true }).eq("dog_id", dogId),
    ]);

    const { allBadges, earnedBadgeIds } = get();
    if (!freshDog || allBadges.length === 0) return;

    const trickCount = freshTricks?.length ?? 0;
    const totalSessions = (sessionCount ?? 0) + trickCount;
    const dog = freshDog;

    const toRevoke: string[] = [];

    for (const badge of allBadges) {
      if (!earnedBadgeIds.includes(badge.id)) continue;

      let stillQualifies = true;
      switch (badge.trigger_type) {
        case "session_count":
          stillQualifies = totalSessions >= badge.trigger_value;
          break;
        case "trick_count":
          stillQualifies = trickCount >= badge.trigger_value;
          break;
        case "level_reach":
          stillQualifies = dog.level >= badge.trigger_value;
          break;
        case "xp_total":
          stillQualifies = dog.total_xp >= badge.trigger_value;
          break;
        case "streak_days":
          stillQualifies = dog.streak_days >= badge.trigger_value;
          break;
      }

      if (!stillQualifies) toRevoke.push(badge.id);
    }

    if (toRevoke.length > 0) {
      // Remove from DB
      for (const badgeId of toRevoke) {
        await supabase
          .from("earned_badges")
          .delete()
          .eq("dog_id", dogId)
          .eq("badge_id", badgeId);
      }

      // Deduct bonus XP
      const revokedBadges = allBadges.filter((b) => toRevoke.includes(b.id));
      const xpToRemove = revokedBadges.reduce((sum, b) => sum + b.xp_reward, 0);
      if (xpToRemove > 0) {
        // Re-fetch dog to get latest XP
        const { data: freshDog } = await supabase.from("dogs").select("*").eq("id", dogId).single();
        const currentXP = freshDog?.total_xp ?? dog.total_xp;
        const newXP = Math.max(0, currentXP - xpToRemove);
        const newLevel = computeLevel(newXP);
        const { data } = await supabase
          .from("dogs")
          .update({ total_xp: newXP, level: newLevel })
          .eq("id", dogId)
          .select()
          .single();
        if (data) set({ dog: data });

        // Negative xp_event for leaderboard accuracy
        await supabase.from("xp_events").insert({
          dog_id: dogId,
          amount: -xpToRemove,
          reason: `Undo badges: ${revokedBadges.map((b) => b.name).join(", ")}`,
        });
      }

      set((state) => ({
        earnedBadgeIds: state.earnedBadgeIds.filter((id) => !toRevoke.includes(id)),
      }));
    }
  },

  recalculateStreak: async (dogId: string) => {
    // Gather all activity dates from training_sessions + daily_mission_completions
    const [{ data: sessions }, { data: missions }] = await Promise.all([
      supabase
        .from("training_sessions")
        .select("completed_at")
        .eq("dog_id", dogId)
        .order("completed_at", { ascending: false }),
      supabase
        .from("daily_mission_completions")
        .select("completed_date")
        .eq("dog_id", dogId)
        .order("completed_date", { ascending: false }),
    ]);

    // Collect unique activity dates (YYYY-MM-DD)
    const dateSet = new Set<string>();
    (sessions ?? []).forEach((s) => {
      const d = new Date(s.completed_at);
      dateSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    });
    (missions ?? []).forEach((m) => {
      dateSet.add(m.completed_date);
    });

    if (dateSet.size === 0) {
      // No activity at all — reset streak
      await supabase
        .from("dogs")
        .update({ streak_days: 0, last_trained_at: null })
        .eq("id", dogId);
      const { data } = await supabase.from("dogs").select("*").eq("id", dogId).single();
      if (data) set({ dog: data });
      return;
    }

    // Sort dates descending
    const sortedDates = [...dateSet].sort().reverse();
    const today = todayDateStr();

    // Find last activity date
    const lastDate = sortedDates[0];

    // Calculate consecutive streak from lastDate backwards
    let streak = 1;
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const current = new Date(sortedDates[i] + "T12:00:00");
      const prev = new Date(sortedDates[i + 1] + "T12:00:00");
      const diffDays = Math.round((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    // If last activity is NOT today and NOT yesterday, streak is broken
    const lastDateObj = new Date(lastDate + "T12:00:00");
    const todayObj = new Date(today + "T12:00:00");
    const daysSinceLast = Math.round((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceLast > 1) {
      streak = 0; // More than 1 day gap = broken
    }

    // If no activity today, last_trained_at should be the last activity
    const lastTrainedAt = lastDate === today
      ? new Date().toISOString()
      : new Date(lastDate + "T23:59:00").toISOString();

    await supabase
      .from("dogs")
      .update({
        streak_days: daysSinceLast > 1 ? 0 : streak,
        last_trained_at: daysSinceLast > 1 ? null : lastTrainedAt,
      })
      .eq("id", dogId);

    const { data } = await supabase.from("dogs").select("*").eq("id", dogId).single();
    if (data) set({ dog: data });
  },

  clearNewlyEarned: () => set({ newlyEarnedBadges: [] }),

  // ── Daily Missions ──

  dailyMissions: [],
  completedDailyIds: [],
  allDailyDone: false,

  loadDailyMissions: async (dogId: string) => {
    const { dog } = get();
    if (!dog) return;

    // Generate today's missions
    const missions = generateDailyMissions(
      dog.training_goals ?? [],
      dog.level,
    );

    // Load today's completions
    const today = todayDateStr();
    const { data } = await supabase
      .from("daily_mission_completions")
      .select("mission_id")
      .eq("dog_id", dogId)
      .eq("completed_date", today);

    const completedIds = (data ?? []).map((r) => r.mission_id);
    const allDone = missions.every((m) => completedIds.includes(m.id));

    set({ dailyMissions: missions, completedDailyIds: completedIds, allDailyDone: allDone });
  },

  completeDailyMission: async (dogId: string, missionId: string) => {
    const { dailyMissions, completedDailyIds, dog } = get();
    if (!dog || completedDailyIds.includes(missionId)) return;

    const mission = dailyMissions.find((m) => m.id === missionId);
    if (!mission) return;

    const today = todayDateStr();

    // Save completion
    await supabase.from("daily_mission_completions").insert({
      dog_id: dogId,
      mission_id: missionId,
      completed_date: today,
    });

    // Award XP
    const newCompletedIds = [...completedDailyIds, missionId];
    const allDone = dailyMissions.every((m) => newCompletedIds.includes(m.id));
    const totalXP = mission.xp_reward + (allDone ? ALL_MISSIONS_BONUS_XP : 0);

    const newXP = dog.total_xp + totalXP;
    const newLevel = computeLevel(newXP);

    const { data } = await supabase
      .from("dogs")
      .update({ total_xp: newXP, level: newLevel })
      .eq("id", dogId)
      .select()
      .single();

    if (data) set({ dog: data });

    const reason = allDone
      ? `Daily mission: ${mission.title} + All missions bonus`
      : `Daily mission: ${mission.title}`;

    await supabase.from("xp_events").insert({
      dog_id: dogId,
      amount: totalXP,
      reason,
    });

    set({ completedDailyIds: newCompletedIds, allDailyDone: allDone });
  },

  undoDailyMission: async (dogId: string, missionId: string) => {
    const { dailyMissions, completedDailyIds, dog } = get();
    if (!dog || !completedDailyIds.includes(missionId)) return;

    const mission = dailyMissions.find((m) => m.id === missionId);
    if (!mission) return;

    const today = todayDateStr();
    const wasAllDone = dailyMissions.every((m) => completedDailyIds.includes(m.id));

    // Remove completion from DB
    await supabase
      .from("daily_mission_completions")
      .delete()
      .eq("dog_id", dogId)
      .eq("mission_id", missionId)
      .eq("completed_date", today);

    // Deduct XP (mission reward + bonus if all-done bonus was awarded)
    const xpToRemove = mission.xp_reward + (wasAllDone ? ALL_MISSIONS_BONUS_XP : 0);
    const newXP = Math.max(0, dog.total_xp - xpToRemove);
    const newLevel = computeLevel(newXP);

    const { data } = await supabase
      .from("dogs")
      .update({ total_xp: newXP, level: newLevel })
      .eq("id", dogId)
      .select()
      .single();

    if (data) set({ dog: data });

    // Negative xp_event so leaderboard stays accurate
    await supabase.from("xp_events").insert({
      dog_id: dogId,
      amount: -xpToRemove,
      reason: `Undo: ${mission.title}${wasAllDone ? " + all missions bonus" : ""}`,
    });

    const newCompletedIds = completedDailyIds.filter((id) => id !== missionId);
    set({ completedDailyIds: newCompletedIds, allDailyDone: false });
  },

  // ── Pro / RevenueCat ──

  isPro: false,

  loadProStatus: async () => {
    const info = await fetchCustomerInfo();
    set({ isPro: hasProEntitlement(info) });
  },

  // Dev-only override so we can test gating before RevenueCat keys are wired up
  setProForDev: (value: boolean) => set({ isPro: value }),
}));
