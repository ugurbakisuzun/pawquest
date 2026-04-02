import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";
import { useStore } from "../lib/store";
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
  const {
    dog,
    setDog,
    completedMissions,
    addCompletedMission,
    removeCompletedMission,
  } = useStore();
  const [loading, setLoading] = useState(!dog);
  const [todayDay, setTodayDay] = useState<number>(1);
  const [programLoading, setProgramLoading] = useState(true);
  const [todayDone, setTodayDone] = useState(false);
  const [tricks, setTricks] = useState<Trick[]>([]);
  const completedIds = completedMissions;

  useEffect(() => {
    if (!dog) loadDog();
    loadTodayDay();
    loadTricks();
  }, []);

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
      if (data) setDog(data);
      else router.replace("/setup" as any);
    } catch {
      router.replace("/" as any);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayDay = async () => {
    try {
      const { data } = await supabase
        .from("training_sessions")
        .select("day_number, completed_at")
        .order("completed_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const lastSession = data[0];
        const lastCompleted = new Date(lastSession.completed_at);
        const now = new Date();
        const isSameDay =
          lastCompleted.getFullYear() === now.getFullYear() &&
          lastCompleted.getMonth() === now.getMonth() &&
          lastCompleted.getDate() === now.getDate();

        setTodayDay(Math.min(lastSession.day_number + 1, 21));
        setTodayDone(isSameDay);
      } else {
        setTodayDay(1);
        setTodayDone(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProgramLoading(false);
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

  const handleTrickPress = async (trick: Trick) => {
    const done = completedIds.includes(trick.id);

    if (done) {
      // Yeşili kaldır + XP düşür
      if (!dog) return;
      const newXP = Math.max(0, dog.total_xp - trick.xp_reward);
      const newLevel =
        newXP >= 3500
          ? 6
          : newXP >= 2000
            ? 5
            : newXP >= 1000
              ? 4
              : newXP >= 500
                ? 3
                : newXP >= 200
                  ? 2
                  : 1;
      try {
        const { data, error } = await supabase
          .from("dogs")
          .update({ total_xp: newXP, level: newLevel })
          .eq("id", dog.id)
          .select()
          .single();
        if (!error) setDog(data);
      } catch (err) {
        console.error(err);
      }
      removeCompletedMission(trick.id);
    } else {
      // Session'a git
      router.push(
        `/session?trickId=${trick.id}&trickName=${encodeURIComponent(trick.name)}&trickDesc=${encodeURIComponent(trick.description ?? "")}&trickXp=${trick.xp_reward}&trickSteps=${encodeURIComponent(JSON.stringify(trick.steps ?? []))}` as any,
      );
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDog(null);
    router.replace("/" as any);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.pawGold} />
      </View>
    );
  }

  if (!dog) return null;

  const xpPercent = Math.min(
    Math.round(((dog.total_xp % 1000) / 1000) * 100),
    100,
  );
  const xpToNext = 1000 - (dog.total_xp % 1000);
  const unlockedTricks = tricks.filter((t) => t.min_level <= dog.level);

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
            onPress={() => router.push("/setup" as any)}
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
              {xpToNext} XP to Level {dog.level + 1}
            </Text>
          </View>
        </View>

        {/* ── Today's Training ── */}
        {!programLoading && (
          <TouchableOpacity
            style={[styles.trainingCard, todayDone && styles.trainingCardDone]}
            onPress={() => {
              if (todayDone) return;
              router.push(
                `/session?day=${todayDay}&slug=separation-anxiety` as any,
              );
            }}
            activeOpacity={todayDone ? 1 : 0.7}
          >
            <View style={styles.trainingLeft}>
              <View style={styles.trainingIcon}>
                <Text style={{ fontSize: 22 }}>{todayDone ? "✅" : "🐾"}</Text>
              </View>
              <View>
                <Text
                  style={[
                    styles.trainingLabel,
                    todayDone && styles.trainingLabelDone,
                  ]}
                >
                  {todayDone
                    ? "COMPLETED · COME BACK TOMORROW"
                    : "TODAY'S TRAINING"}
                </Text>
                <Text
                  style={[
                    styles.trainingTitle,
                    todayDone && styles.trainingTitleDone,
                  ]}
                >
                  {todayDone
                    ? `Tomorrow: Day ${todayDay}`
                    : `Separation Anxiety · Day ${todayDay}`}
                </Text>
                <Text
                  style={[
                    styles.trainingMeta,
                    todayDone && styles.trainingMetaDone,
                  ]}
                >
                  {todayDone
                    ? "Great work today! 🔥"
                    : "Tap to start your session"}
                </Text>
              </View>
            </View>
            {!todayDone && (
              <View style={styles.trainingArrow}>
                <Text
                  style={{
                    color: Palette.questNight,
                    fontSize: 18,
                    fontWeight: "700",
                  }}
                >
                  →
                </Text>
              </View>
            )}
          </TouchableOpacity>
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
            const done = completedIds.includes(trick.id);
            return (
              <TouchableOpacity
                key={trick.id}
                style={[styles.missionCard, done && styles.missionDone]}
                onPress={() => handleTrickPress(trick)}
              >
                <View style={styles.missionIcon}>
                  <Text style={{ fontSize: 22 }}>
                    {done ? "✅" : (CATEGORY_ICONS[trick.category] ?? "🐾")}
                  </Text>
                </View>
                <View style={styles.missionInfo}>
                  <Text style={styles.missionTitle}>{trick.name}</Text>
                  <View style={styles.missionMeta}>
                    <Text style={styles.missionCategory}>{trick.category}</Text>
                    <View style={styles.xpPill}>
                      <Text style={styles.xpPillText}>
                        {done
                          ? `−${trick.xp_reward} XP to undo`
                          : `+${trick.xp_reward} XP`}
                      </Text>
                    </View>
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
          onPress={() => {
            if (todayDone) return;
            router.push(
              `/session?day=${todayDay}&slug=separation-anxiety` as any,
            );
          }}
        >
          <Text style={styles.navIcon}>🎯</Text>
          <Text style={styles.navLabel}>Train</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
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
        <TouchableOpacity style={styles.navItem} onPress={handleSignOut}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Sign out</Text>
        </TouchableOpacity>
      </View>
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
