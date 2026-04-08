import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";
import { ALL_MISSIONS_BONUS_XP } from "../lib/missions";
import { computeLevel, getLevelInfo, getRarityColor, useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.dark;

interface Trick {
  id: string;
  name: string;
  category: string;
  xp_reward: number;
  min_level: number;
  difficulty: number;
  description: string;
  steps: string[];
}

export default function DashboardScreen() {
  const params = useLocalSearchParams();
  const {
    dog,
    setDog,
    completedMissions,
    loadCompletedTricks,
    syncCompletedTrick,
    unsyncCompletedTrick,
    allBadges,
    earnedBadgeIds,
    loadBadges,
    clearNewlyEarned,
    recheckAndRevokeBadges,
    dailyMissions,
    completedDailyIds,
    allDailyDone,
    loadDailyMissions,
    completeDailyMission,
    undoDailyMission,
    checkAndAwardBadges,
    recalculateStreak,
    isPro,
  } = useStore();
  const [loading, setLoading] = useState(!dog);
  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [programProgress, setProgramProgress] = useState<Record<string, { nextDay: number; doneToday: boolean }>>({});
  const [programLoading, setProgramLoading] = useState(true);
  const [editProgramsOpen, setEditProgramsOpen] = useState(false);
  const [editingSlugs, setEditingSlugs] = useState<string[]>([]);
  const [savingPrograms, setSavingPrograms] = useState(false);
  const [tricks, setTricks] = useState<Trick[]>([]);
  const [badgeToast, setBadgeToast] = useState<string | null>(null);
  const [badgeToastXP, setBadgeToastXP] = useState(0);

  useEffect(() => {
    if (!dog) loadDog();
    else {
      loadCompletedTricks(dog.id);
      loadBadges(dog.id);
      loadDailyMissions(dog.id);
    }
    loadPrograms();
    loadTricks();
  }, []);

  // Badge toast from session
  useEffect(() => {
    if (params.newBadges) {
      setBadgeToast(decodeURIComponent(params.newBadges as string));
      setBadgeToastXP(Number(params.badgeXP) || 0);
      setTimeout(() => setBadgeToast(null), 5000);
    }
  }, [params.newBadges]);

  const loadDog = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/" as any);
        return;
      }
      const { data } = await supabase
        .from("dogs")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      if (data) {
        setDog(data);
        await loadCompletedTricks(data.id);
        await loadBadges(data.id);
        await loadDailyMissions(data.id);
      } else router.replace("/setup" as any);
    } catch {
      router.replace("/" as any);
    } finally {
      setLoading(false);
    }
  };

  const loadPrograms = async () => {
    try {
      // Load all programs (for both display + edit modal)
      const { data: progs } = await supabase
        .from("training_programs")
        .select("slug, title, description, total_days")
        .order("total_days", { ascending: false });
      setAllPrograms(progs ?? []);

      // Load sessions to calculate progress (used for any program user has)
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("program_slug, day_number, completed_at")
        .order("completed_at", { ascending: false });

      const progress: Record<string, { nextDay: number; doneToday: boolean }> = {};
      const now = new Date();

      for (const prog of progs ?? []) {
        const progSessions = (sessions ?? []).filter((s) => s.program_slug === prog.slug);
        if (progSessions.length > 0) {
          const last = progSessions[0];
          const lastDate = new Date(last.completed_at);
          const isSameDay =
            lastDate.getFullYear() === now.getFullYear() &&
            lastDate.getMonth() === now.getMonth() &&
            lastDate.getDate() === now.getDate();
          progress[prog.slug] = {
            nextDay: Math.min(last.day_number + 1, prog.total_days),
            doneToday: isSameDay,
          };
        } else {
          progress[prog.slug] = { nextDay: 1, doneToday: false };
        }
      }
      setProgramProgress(progress);
    } catch (err) {
      console.error(err);
    } finally {
      setProgramLoading(false);
    }
  };

  const openEditPrograms = () => {
    setEditingSlugs(dog?.active_program_slugs ?? []);
    setEditProgramsOpen(true);
  };

  const toggleEditingSlug = (slug: string) => {
    setEditingSlugs((prev) => {
      const isSelected = prev.includes(slug);
      if (isSelected) return prev.filter((s) => s !== slug);
      // Free users capped at 1 active program
      if (!isPro && prev.length >= 1) {
        setEditProgramsOpen(false);
        router.push("/paywall" as any);
        return prev;
      }
      return [...prev, slug];
    });
  };

  const saveEditPrograms = async () => {
    if (!dog) return;
    if (editingSlugs.length === 0) {
      Alert.alert("Pick at least one", "You need to keep at least one program active.");
      return;
    }
    setSavingPrograms(true);
    try {
      const { data, error } = await supabase
        .from("dogs")
        .update({ active_program_slugs: editingSlugs })
        .eq("id", dog.id)
        .select()
        .single();
      if (error) throw error;
      if (data) setDog(data);
      setEditProgramsOpen(false);
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message ?? "Try again.");
    } finally {
      setSavingPrograms(false);
    }
  };

  const loadTricks = async () => {
    try {
      const { data } = await supabase
        .from("tricks")
        .select(
          "id, name, category, xp_reward, min_level, difficulty, description, steps",
        )
        .order("min_level", { ascending: true });
      setTricks(data ?? []);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Shared undo helpers ──

  const fullUndoTrick = async (trickId: string, trickXpReward: number) => {
    if (!dog) return;
    // Deduct trick XP
    const newXP = Math.max(0, dog.total_xp - trickXpReward);
    const newLevel = computeLevel(newXP);
    const { data, error } = await supabase
      .from("dogs")
      .update({ total_xp: newXP, level: newLevel })
      .eq("id", dog.id)
      .select()
      .single();
    if (!error && data) setDog(data);
    // Negative xp_event so leaderboard stays accurate
    const trick = tricks.find((t) => t.id === trickId);
    await supabase.from("xp_events").insert({
      dog_id: dog.id,
      amount: -trickXpReward,
      reason: `Undo: ${trick?.name ?? "trick"}`,
    });
    await unsyncCompletedTrick(dog.id, trickId);
    // Undo daily trick mission if completed
    const trickMission = dailyMissions.find(
      (m) => m.type === "trick" && completedDailyIds.includes(m.id),
    );
    if (trickMission) {
      await undoDailyMission(dog.id, trickMission.id);
    }
  };

  const fullUndoSASession = async () => {
    if (!dog) return;
    // Find and delete today's training session
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { data: todaySessions } = await supabase
      .from("training_sessions")
      .select("id, day_number")
      .eq("dog_id", dog.id)
      .gte("completed_at", todayStart)
      .order("completed_at", { ascending: false })
      .limit(1);

    if (todaySessions && todaySessions.length > 0) {
      const session = todaySessions[0];
      await supabase.from("training_sessions").delete().eq("id", session.id);

      // Find the XP that was awarded for this session from xp_events
      const { data: xpEvent } = await supabase
        .from("xp_events")
        .select("amount")
        .eq("dog_id", dog.id)
        .gte("created_at", todayStart)
        .like("reason", `% Day%`)
        .order("created_at", { ascending: false })
        .limit(1);

      const saXP = xpEvent?.[0]?.amount ?? 0;
      if (saXP > 0) {
        const newXP = Math.max(0, dog.total_xp - saXP);
        const newLevel = computeLevel(newXP);
        const { data, error } = await supabase
          .from("dogs")
          .update({ total_xp: newXP, level: newLevel })
          .eq("id", dog.id)
          .select()
          .single();
        if (!error && data) setDog(data);

        await supabase.from("xp_events").insert({
          dog_id: dog.id,
          amount: -saXP,
          reason: `Undo: SA Day ${session.day_number}`,
        });
      }

      // Undo daily SA mission if completed
      const saMission = dailyMissions.find(
        (m) => m.type === "sa_session" && completedDailyIds.includes(m.id),
      );
      if (saMission) {
        await undoDailyMission(dog.id, saMission.id);
      }

      // Refresh today's training state
      await loadPrograms();
    }
  };

  const finishUndo = async () => {
    if (!dog) return;
    await recalculateStreak(dog.id);
    await recheckAndRevokeBadges(dog.id);
    await loadBadges(dog.id);
    await loadDailyMissions(dog.id);
  };

  // ── Trick press handler ──

  const handleTrickPress = async (trick: Trick) => {
    if (!dog) return;
    const done = completedMissions.includes(trick.id);

    if (done) {
      Alert.alert(
        "Undo Trick?",
        `Are you sure you want to undo "${trick.name}"?\n\nYou'll lose ${trick.xp_reward} XP and any related daily missions & badges may be revoked.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Undo",
            style: "destructive",
            onPress: async () => {
              await fullUndoTrick(trick.id, trick.xp_reward);
              await finishUndo();
            },
          },
        ],
      );
      return;
    }

    router.push(
      `/session?trickId=${trick.id}&trickName=${encodeURIComponent(trick.name)}&trickDesc=${encodeURIComponent(trick.description ?? "")}&trickXp=${trick.xp_reward}&trickSteps=${encodeURIComponent(JSON.stringify(trick.steps ?? []))}` as any,
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.pawGold} />
      </View>
    );
  }

  if (!dog) return null;

  // Compute progress within the current level using the real level thresholds
  const levelInfo = getLevelInfo(dog.total_xp);
  const xpInLevel = dog.total_xp - levelInfo.currentLevelXP;
  const xpForLevel = Math.max(1, levelInfo.nextLevelXP - levelInfo.currentLevelXP);
  const isMaxLevel = levelInfo.nextLevelXP === levelInfo.currentLevelXP;
  const xpPercent = isMaxLevel ? 100 : Math.min(100, Math.round((xpInLevel / xpForLevel) * 100));
  const xpToNext = isMaxLevel ? 0 : levelInfo.nextLevelXP - dog.total_xp;
  const unlockedTricks = tricks.filter((t) => t.min_level <= dog.level);
  // Free trick IDs = first 5 tricks (already sorted by min_level in loadTricks)
  const FREE_TRICK_LIMIT = 5;
  const freeTrickIds = new Set(tricks.slice(0, FREE_TRICK_LIMIT).map((t) => t.id));

  const CATEGORY_ICONS: Record<string, string> = {
    Basic: "🎯",
    Fun: "🎪",
    Safety: "🛡️",
    Advanced: "⚡",
    Sport: "🏃",
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.ownerName}>{dog.name} 🐶</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push("/profile" as any)}
          >
            <Text style={styles.avatarEmoji}>🐾</Text>
          </TouchableOpacity>
        </View>

        {/* ── XP Card ── */}
        <View style={styles.xpCard}>
          <View style={styles.xpHeader}>
            <View style={styles.dogChip}>
              <View style={styles.dogAvatar}>
                <Text style={styles.dogAvatarEmoji}>🦮</Text>
              </View>
              <View>
                <Text style={styles.dogChipName}>{dog.name}</Text>
                <Text style={styles.dogChipLevel}>
                  Level {dog.level} · {dog.breed}
                </Text>
              </View>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>LVL {dog.level}</Text>
            </View>
          </View>
          <View style={styles.xpBarWrap}>
            <View
              style={[styles.xpBarFill, { width: `${xpPercent}%` as any }]}
            />
          </View>
          <View style={styles.xpLabels}>
            <Text style={styles.xpCurrent}>{dog.total_xp} XP</Text>
            <Text style={styles.xpRemaining}>
              {isMaxLevel
                ? "Max level reached 👑"
                : `${xpToNext} XP to Level ${dog.level + 1}`}
            </Text>
          </View>
        </View>

        {/* ── My Programs ── */}
        {!programLoading && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Programs</Text>
              <TouchableOpacity onPress={openEditPrograms}>
                <Text style={styles.sectionLink}>Edit ✏️</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 10 }}
              style={{ marginBottom: Spacing.lg }}
            >
              {allPrograms
                .filter((p) => (dog.active_program_slugs ?? []).includes(p.slug))
                .map((prog) => {
                const progress = programProgress[prog.slug] ?? { nextDay: 1, doneToday: false };
                const percent = Math.round(((progress.nextDay - 1) / prog.total_days) * 100);
                const completed = progress.nextDay > prog.total_days;
                const PROG_EMOJI: Record<string, string> = {
                  "separation-anxiety": "🏠",
                  "leash-walking": "🦮",
                  "recall-training": "📣",
                  "potty-training": "🚽",
                };
                return (
                  <TouchableOpacity
                    key={prog.slug}
                    style={[
                      styles.programCard,
                      progress.doneToday && styles.programCardDone,
                      completed && styles.programCardCompleted,
                    ]}
                    onPress={() => {
                      if (progress.doneToday || completed) return;
                      router.push(
                        `/session?day=${progress.nextDay}&slug=${prog.slug}&programTitle=${encodeURIComponent(prog.title)}` as any,
                      );
                    }}
                    activeOpacity={progress.doneToday || completed ? 1 : 0.7}
                  >
                    <Text style={styles.programEmoji}>
                      {completed ? "🏆" : progress.doneToday ? "✅" : (PROG_EMOJI[prog.slug] ?? "🐾")}
                    </Text>
                    <Text style={[styles.programTitle, (progress.doneToday || completed) && { color: C.text }]} numberOfLines={1}>{prog.title}</Text>
                    <Text style={[styles.programMeta, (progress.doneToday || completed) && { color: C.textSecondary }]}>
                      {completed
                        ? "Completed!"
                        : progress.doneToday
                        ? "Done today"
                        : `Day ${progress.nextDay}/${prog.total_days}`}
                    </Text>
                    {/* Progress bar */}
                    <View style={styles.programBarBg}>
                      <View style={[styles.programBarFill, { width: `${Math.min(percent, 100)}%` }]} />
                    </View>
                    <Text style={styles.programPercent}>{Math.min(percent, 100)}%</Text>
                  </TouchableOpacity>
                );
              })}
              {/* Add program placeholder card */}
              <TouchableOpacity
                style={styles.programAddCard}
                onPress={openEditPrograms}
                activeOpacity={0.7}
              >
                <Text style={styles.programAddIcon}>+</Text>
                <Text style={styles.programAddText}>Add Program</Text>
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={[styles.statVal, { color: C.xp }]}>
              {dog.streak_days}
            </Text>
            <Text style={styles.statLbl}>Day streak</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statVal}>{dog.total_xp}</Text>
            <Text style={styles.statLbl}>Total XP</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statIcon}>🏅</Text>
            <Text style={[styles.statVal, { color: C.success }]}>
              Lv.{dog.level}
            </Text>
            <Text style={styles.statLbl}>Level</Text>
          </View>
        </View>

        {/* ── Daily Missions ── */}
        {dailyMissions.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Daily Missions</Text>
              <Text style={styles.sectionLink}>
                {completedDailyIds.length}/{dailyMissions.length} done
              </Text>
            </View>

            {dailyMissions.map((mission) => {
              const done = completedDailyIds.includes(mission.id);
              return (
                <TouchableOpacity
                  key={mission.id}
                  style={[styles.missionCard, done && styles.missionDone]}
                  onPress={async () => {
                    if (!dog) return;

                    // ── Undo completed mission (cascade by type) ──
                    if (done) {
                      if (mission.type === "trick") {
                        // Trick mission undo → also undo the trick from library
                        // Find the trick completed today via xp_events
                        const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString();
                        const { data: xpEvents } = await supabase
                          .from("xp_events")
                          .select("amount, reason")
                          .eq("dog_id", dog.id)
                          .gte("created_at", todayStart)
                          .like("reason", "% trick")
                          .order("created_at", { ascending: false })
                          .limit(1);
                        const trickReason = xpEvents?.[0]?.reason ?? "";
                        const trickName = trickReason.replace(" trick", "");
                        const matchedTrick = tricks.find((t) => t.name === trickName);

                        const trickInfo = matchedTrick
                          ? `\nThis will also undo "${matchedTrick.name}" (-${matchedTrick.xp_reward} XP) from Trick Library.`
                          : "";

                        Alert.alert(
                          "Undo Trick Mission?",
                          `Undo "${mission.title}"?${trickInfo}\n\nDaily mission XP (-${mission.xp_reward}) and related badges will also be revoked.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Undo All",
                              style: "destructive",
                              onPress: async () => {
                                if (matchedTrick) {
                                  await fullUndoTrick(matchedTrick.id, matchedTrick.xp_reward);
                                } else {
                                  await undoDailyMission(dog.id, mission.id);
                                }
                                await finishUndo();
                              },
                            },
                          ],
                        );
                      } else if (mission.type === "sa_session") {
                        // Training session undo → also undo today's training session
                        Alert.alert(
                          "Undo Training Session?",
                          `Undo "${mission.title}"?\n\nThis will also undo today's program session and all related XP & badges.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Undo All",
                              style: "destructive",
                              onPress: async () => {
                                await fullUndoSASession();
                                await finishUndo();
                              },
                            },
                          ],
                        );
                      } else {
                        // Quick challenge — simple undo
                        Alert.alert(
                          "Undo Challenge?",
                          `Undo "${mission.title}"?\n\nYou'll lose ${mission.xp_reward} XP${allDailyDone ? " + 30 bonus XP" : ""}.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Undo",
                              style: "destructive",
                              onPress: async () => {
                                await undoDailyMission(dog.id, mission.id);
                                await finishUndo();
                              },
                            },
                          ],
                        );
                      }
                      return;
                    }

                    // ── Start new mission ──
                    if (mission.type === "sa_session") {
                      // Find first active program that isn't done today / completed
                      const activeSlugs = dog.active_program_slugs ?? [];
                      const candidate = allPrograms.find((p) => {
                        if (!activeSlugs.includes(p.slug)) return false;
                        const prog = programProgress[p.slug] ?? { nextDay: 1, doneToday: false };
                        return !prog.doneToday && prog.nextDay <= p.total_days;
                      });
                      if (candidate) {
                        const prog = programProgress[candidate.slug] ?? { nextDay: 1, doneToday: false };
                        router.push(
                          `/session?day=${prog.nextDay}&slug=${candidate.slug}&programTitle=${encodeURIComponent(candidate.title)}` as any,
                        );
                      } else {
                        Alert.alert("All done for today!", "You've completed today's program sessions. Come back tomorrow.");
                      }
                      return;
                    }
                    if (mission.type === "trick") {
                      router.push("/tricks" as any);
                      return;
                    }
                    // Quick challenge — confirm and complete
                    Alert.alert(
                      `${mission.emoji} ${mission.title}`,
                      `${mission.description}\n\nDid you complete this challenge?`,
                      [
                        { text: "Not yet", style: "cancel" },
                        {
                          text: `Done! +${mission.xp_reward} XP`,
                          onPress: async () => {
                            await completeDailyMission(dog.id, mission.id);
                            await loadBadges(dog.id);
                            await checkAndAwardBadges(dog.id);
                          },
                        },
                      ],
                    );
                  }}
                  activeOpacity={done ? 1 : 0.7}
                >
                  <View style={styles.missionIcon}>
                    <Text style={{ fontSize: 22 }}>{done ? "✅" : mission.emoji}</Text>
                  </View>
                  <View style={styles.missionInfo}>
                    <Text style={styles.missionTitle}>{mission.title}</Text>
                    <Text style={styles.missionCategory}>{mission.description}</Text>
                  </View>
                  <View style={styles.xpPill}>
                    <Text style={styles.xpPillText}>
                      {done ? "Done" : `+${mission.xp_reward} XP`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* All missions bonus */}
            <View style={[styles.missionBonusBar, allDailyDone && styles.missionBonusDone]}>
              <Text style={styles.missionBonusText}>
                {allDailyDone
                  ? `🎉 All missions complete! +${ALL_MISSIONS_BONUS_XP} bonus XP earned`
                  : `Complete all 3 for +${ALL_MISSIONS_BONUS_XP} bonus XP`}
              </Text>
              {!allDailyDone && (
                <View style={styles.missionBonusDots}>
                  {dailyMissions.map((m) => (
                    <View
                      key={m.id}
                      style={[
                        styles.missionBonusDot,
                        completedDailyIds.includes(m.id) && styles.missionBonusDotDone,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Badge Toast ── */}
        {badgeToast && (
          <View style={styles.badgeToast}>
            <Text style={styles.badgeToastTitle}>Badge Unlocked!</Text>
            <Text style={styles.badgeToastText}>{badgeToast}</Text>
            {badgeToastXP > 0 && (
              <Text style={styles.badgeToastXP}>+{badgeToastXP} bonus XP</Text>
            )}
          </View>
        )}

        {/* ── Badges Section ── */}
        {allBadges.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Badges</Text>
              <TouchableOpacity onPress={() => router.push("/badges" as any)}>
                <Text style={styles.sectionLink}>
                  {earnedBadgeIds.length}/{allBadges.length} earned →
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.badgeScroll}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 10 }}
            >
              {allBadges.slice(0, 10).map((badge) => {
                const earned = earnedBadgeIds.includes(badge.id);
                return (
                  <TouchableOpacity
                    key={badge.id}
                    style={[styles.badgeCard, !earned && styles.badgeCardLocked]}
                    onPress={() => router.push("/badges" as any)}
                  >
                    <Text style={[styles.badgeEmoji, !earned && { opacity: 0.3 }]}>
                      {badge.emoji}
                    </Text>
                    <Text
                      style={[styles.badgeName, !earned && { color: C.textMuted }]}
                      numberOfLines={2}
                    >
                      {badge.name}
                    </Text>
                    {earned && (
                      <View style={[styles.badgeRarity, { backgroundColor: getRarityColor(badge.rarity) + "25" }]}>
                        <Text style={[styles.badgeRarityText, { color: getRarityColor(badge.rarity) }]}>
                          {badge.rarity}
                        </Text>
                      </View>
                    )}
                    {!earned && <Text style={styles.badgeLock}>🔒</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* ── Streak Banner ── */}
        {dog.streak_days > 0 && (
          <View style={styles.streakBanner}>
            <Text style={styles.streakFlame}>🔥</Text>
            <View>
              <Text style={styles.streakTitle}>
                {dog.streak_days}-day streak!
              </Text>
              <Text style={styles.streakSub}>
                Keep it up — you're on a roll!
              </Text>
            </View>
          </View>
        )}

        {/* ── Trick Library ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trick Library</Text>
          <TouchableOpacity onPress={() => router.push("/tricks" as any)}>
            <Text style={styles.sectionLink}>See all →</Text>
          </TouchableOpacity>
        </View>

        {unlockedTricks.length === 0 ? (
          <View style={styles.emptyMissions}>
            <Text style={styles.emptyText}>
              Complete your training to unlock tricks! 🔒
            </Text>
          </View>
        ) : (
          unlockedTricks.slice(0, 5).map((trick) => {
            const done = completedMissions.includes(trick.id);
            const proLocked = !isPro && !freeTrickIds.has(trick.id);
            return (
              <TouchableOpacity
                key={trick.id}
                style={[styles.missionCard, done && styles.missionDone]}
                onPress={() =>
                  proLocked ? router.push("/paywall" as any) : handleTrickPress(trick)
                }
              >
                <View style={styles.missionIcon}>
                  <Text style={{ fontSize: 22 }}>
                    {proLocked
                      ? "🔒"
                      : done
                        ? "✅"
                        : (CATEGORY_ICONS[trick.category] ?? "🐾")}
                  </Text>
                </View>
                <View style={styles.missionInfo}>
                  <Text style={styles.missionTitle}>{trick.name}</Text>
                  <View style={styles.missionMeta}>
                    <Text style={styles.missionCategory}>{trick.category}</Text>
                    {proLocked ? (
                      <View style={styles.proPill}>
                        <Text style={styles.proPillText}>PRO</Text>
                      </View>
                    ) : (
                      <View style={styles.xpPill}>
                        <Text style={styles.xpPillText}>
                          {done
                            ? `−${trick.xp_reward} XP to undo`
                            : `+${trick.xp_reward} XP`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View
                  style={[
                    styles.checkCircle,
                    done ? styles.checkDone : styles.checkTodo,
                  ]}
                >
                  {done && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {unlockedTricks.length > 5 && (
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => router.push("/tricks" as any)}
          >
            <Text style={styles.viewAllText}>
              View all {unlockedTricks.length} tricks →
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom Nav ── */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={[styles.navLabel, styles.navActive]}>Home</Text>
          <View style={styles.navDot} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/walk" as any)}
        >
          <Text style={styles.navIcon}>🚶</Text>
          <Text style={styles.navLabel}>Walk</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/calendar" as any)}
        >
          <Text style={styles.navIcon}>📅</Text>
          <Text style={styles.navLabel}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/leaderboard" as any)}
        >
          <Text style={styles.navIcon}>🏆</Text>
          <Text style={styles.navLabel}>Ranks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/advisor" as any)}
        >
          <Text style={styles.navIcon}>🤖</Text>
          <Text style={styles.navLabel}>AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            if (dog?.track_health) {
              router.push("/health" as any);
            } else {
              Alert.alert(
                "Health Tracker",
                "Enable health tracking in your dog's profile to access this feature.",
                [
                  { text: "Not now" },
                  { text: "Open anyway", onPress: () => router.push("/health" as any) },
                ],
              );
            }
          }}
        >
          <Text style={styles.navIcon}>🏥</Text>
          <Text style={styles.navLabel}>Health</Text>
        </TouchableOpacity>
      </View>

      {/* ── Edit Programs Modal ── */}
      <Modal
        visible={editProgramsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditProgramsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Your Programs</Text>
            <Text style={styles.modalSub}>Add or remove programs from your dashboard.</Text>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {allPrograms.map((p) => {
                const sel = editingSlugs.includes(p.slug);
                const PROG_EMOJI: Record<string, string> = {
                  "separation-anxiety": "🏠",
                  "leash-walking": "🦮",
                  "recall-training": "📣",
                  "potty-training": "🚽",
                };
                return (
                  <TouchableOpacity
                    key={p.slug}
                    style={[styles.modalRow, sel && styles.modalRowOn]}
                    onPress={() => toggleEditingSlug(p.slug)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.modalRowIcon}>
                      <Text style={{ fontSize: 22 }}>{PROG_EMOJI[p.slug] ?? "🐾"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalRowTitle, sel && { color: C.text }]} numberOfLines={1}>
                        {p.title}
                      </Text>
                      <Text style={styles.modalRowDesc} numberOfLines={2}>
                        {p.description ?? `${p.total_days} days`}
                      </Text>
                    </View>
                    <View style={[styles.modalCheck, sel && styles.modalCheckOn]}>
                      {sel && <Text style={styles.modalCheckMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditProgramsOpen(false)}
                disabled={savingPrograms}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, savingPrograms && { opacity: 0.6 }]}
                onPress={saveEditPrograms}
                disabled={savingPrograms}
              >
                <Text style={styles.modalSaveText}>
                  {savingPrograms ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
  },
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
  },
  greeting: { color: C.textSecondary, fontSize: 14 },
  ownerName: { color: C.text, fontSize: 22, fontWeight: "700", marginTop: 2 },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 20 },

  xpCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: Spacing.md,
  },
  xpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  dogChip: { flexDirection: "row", alignItems: "center", gap: 10 },
  dogAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Palette.pawGold,
    alignItems: "center",
    justifyContent: "center",
  },
  dogAvatarEmoji: { fontSize: 20 },
  dogChipName: { color: C.text, fontWeight: "600", fontSize: 15 },
  dogChipLevel: { color: C.xp, fontSize: 12, marginTop: 1 },
  levelBadge: {
    backgroundColor: "rgba(250,199,117,0.15)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.3)",
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeText: { color: C.xp, fontSize: 11, fontWeight: "700" },
  xpBarWrap: {
    backgroundColor: C.border,
    borderRadius: Radius.sm,
    height: 8,
    overflow: "hidden",
    marginBottom: 6,
  },
  xpBarFill: {
    height: "100%",
    borderRadius: Radius.sm,
    backgroundColor: Palette.pawGold,
  },
  xpLabels: { flexDirection: "row", justifyContent: "space-between" },
  xpCurrent: { color: C.xp, fontSize: 11, fontWeight: "600" },
  xpRemaining: { color: C.textSecondary, fontSize: 11 },

  trainingCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trainingCardDone: {
    backgroundColor: "rgba(29,158,117,0.15)",
    borderWidth: 1,
    borderColor: "rgba(29,158,117,0.3)",
  },
  trainingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  trainingIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: "rgba(15,11,46,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  trainingLabel: {
    color: "rgba(15,11,46,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  trainingLabelDone: { color: C.success },
  trainingTitle: {
    color: Palette.questNight,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  trainingTitleDone: { color: C.text },
  trainingMeta: { color: "rgba(15,11,46,0.55)", fontSize: 11 },
  trainingMetaDone: { color: C.textSecondary },
  trainingArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15,11,46,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statChip: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: "center",
  },
  statIcon: { fontSize: 16, marginBottom: 4 },
  statVal: { color: C.text, fontSize: 20, fontWeight: "700" },
  statLbl: { color: C.textSecondary, fontSize: 11, marginTop: 2 },

  streakBanner: {
    marginHorizontal: Spacing.xl,
    backgroundColor: "rgba(250,199,117,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.15)",
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: Spacing.xl,
  },
  streakFlame: { fontSize: 28 },
  streakTitle: { color: C.text, fontWeight: "700", fontSize: 15 },
  streakSub: { color: C.textSecondary, fontSize: 12, marginTop: 2 },

  sectionHeader: {
    paddingHorizontal: Spacing.xl,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  sectionLink: { color: C.accent, fontSize: 13 },

  emptyMissions: {
    marginHorizontal: Spacing.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { color: C.textSecondary, fontSize: 13, textAlign: "center" },

  missionCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },
  missionDone: { opacity: 0.65 },
  missionIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: "rgba(250,199,117,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  missionInfo: { flex: 1 },
  missionTitle: {
    color: C.text,
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 4,
  },
  missionMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  missionCategory: { color: C.textSecondary, fontSize: 12 },
  xpPill: {
    backgroundColor: "rgba(250,199,117,0.15)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  xpPillText: { color: C.xp, fontSize: 11, fontWeight: "600" },
  proPill: {
    backgroundColor: "rgba(127,119,221,0.18)",
    borderWidth: 1,
    borderColor: Palette.levelPurple,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proPillText: {
    color: Palette.levelPurple,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: "rgba(29,158,117,0.15)" },
  checkTodo: { borderWidth: 1.5, borderColor: C.border },
  checkMark: { color: C.success, fontSize: 13, fontWeight: "700" },

  // Program cards
  programCard: {
    width: 140, backgroundColor: Palette.pawGold, borderRadius: Radius.lg,
    padding: 14, alignItems: "center",
  },
  programCardDone: {
    backgroundColor: "rgba(29,158,117,0.15)",
    borderWidth: 1, borderColor: "rgba(29,158,117,0.3)",
  },
  programCardCompleted: {
    backgroundColor: "rgba(127,119,221,0.15)",
    borderWidth: 1, borderColor: "rgba(127,119,221,0.3)",
  },
  programEmoji: { fontSize: 28, marginBottom: 6 },
  programTitle: { color: Palette.questNight, fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  programMeta: { color: "rgba(15,11,46,0.6)", fontSize: 11, marginBottom: 8 },
  programBarBg: { width: "100%", height: 4, backgroundColor: "rgba(15,11,46,0.15)", borderRadius: 2, overflow: "hidden" },
  programBarFill: { height: "100%", backgroundColor: Palette.questNight, borderRadius: 2 },
  programPercent: { color: "rgba(15,11,46,0.5)", fontSize: 10, fontWeight: "600", marginTop: 4 },
  programAddCard: {
    width: 140, backgroundColor: C.surface, borderRadius: Radius.lg,
    padding: 14, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed",
    minHeight: 132,
  },
  programAddIcon: { color: Palette.pawGold, fontSize: 36, fontWeight: "300", marginBottom: 4 },
  programAddText: { color: C.textSecondary, fontSize: 13, fontWeight: "600" },

  // Edit Programs Modal
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl, paddingTop: 12, paddingBottom: 32,
    borderTopWidth: 1, borderColor: C.border,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: { color: C.text, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  modalSub: { color: C.textSecondary, fontSize: 13, marginBottom: 18 },
  modalRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    borderRadius: Radius.lg, padding: 14, marginBottom: 8,
  },
  modalRowOn: { borderColor: Palette.pawGold, backgroundColor: "rgba(250,199,117,0.08)" },
  modalRowIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: "rgba(250,199,117,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  modalRowTitle: { color: C.textSecondary, fontSize: 15, fontWeight: "600", marginBottom: 2 },
  modalRowDesc: { color: C.textMuted, fontSize: 12 },
  modalCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  modalCheckOn: { backgroundColor: Palette.pawGold, borderColor: Palette.pawGold },
  modalCheckMark: { color: Palette.questNight, fontSize: 14, fontWeight: "800" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalCancel: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, paddingVertical: 16, alignItems: "center",
  },
  modalCancelText: { color: C.textSecondary, fontSize: 15, fontWeight: "600" },
  modalSave: {
    flex: 2, backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg, paddingVertical: 16, alignItems: "center",
  },
  modalSaveText: { color: Palette.questNight, fontSize: 15, fontWeight: "700" },

  // Daily missions bonus bar
  missionBonusBar: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  missionBonusDone: {
    backgroundColor: "rgba(250,199,117,0.1)",
    borderColor: "rgba(250,199,117,0.3)",
  },
  missionBonusText: { color: C.textSecondary, fontSize: 12, fontWeight: "500", flex: 1 },
  missionBonusDots: { flexDirection: "row", gap: 6, marginLeft: 8 },
  missionBonusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.border },
  missionBonusDotDone: { backgroundColor: Palette.pawGold },

  // Badge toast
  badgeToast: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: "rgba(250,199,117,0.15)",
    borderWidth: 1,
    borderColor: Palette.pawGold,
    borderRadius: Radius.lg,
    padding: 16,
    alignItems: "center",
  },
  badgeToastTitle: { color: Palette.pawGold, fontSize: 16, fontWeight: "700", marginBottom: 4 },
  badgeToastText: { color: C.text, fontSize: 14, textAlign: "center" },
  badgeToastXP: { color: Palette.pawGold, fontSize: 13, fontWeight: "600", marginTop: 4 },

  // Badges section
  badgeScroll: { marginBottom: Spacing.lg },
  badgeCard: {
    width: 90,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 10,
    alignItems: "center",
  },
  badgeCardLocked: { opacity: 0.5 },
  badgeEmoji: { fontSize: 28, marginBottom: 6 },
  badgeName: { color: C.text, fontSize: 10, fontWeight: "600", textAlign: "center", lineHeight: 14 },
  badgeRarity: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  badgeRarityText: { fontSize: 9, fontWeight: "700", textTransform: "capitalize" as any },
  badgeLock: { fontSize: 12, marginTop: 4 },

  viewAllBtn: {
    marginHorizontal: Spacing.xl,
    marginBottom: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: "center",
  },
  viewAllText: { color: C.accent, fontSize: 13, fontWeight: "600" },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: "row",
    paddingBottom: 24,
    paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10, fontWeight: "500", color: C.textSecondary },
  navActive: { color: C.accent },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent },
});
