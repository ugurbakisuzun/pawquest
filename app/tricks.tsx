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
import { computeLevel, useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.dark;

interface Trick {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  category: string;
  min_level: number;
  xp_reward: number;
  steps: string[];
}

const CATEGORY_ICONS: Record<string, string> = {
  Basic: "🎯",
  Fun: "🎪",
  Safety: "🛡️",
  Advanced: "⚡",
  Sport: "🏃",
};

const CATEGORY_COLORS: Record<string, string> = {
  Basic: "rgba(29,158,117,0.08)",
  Fun: "rgba(250,199,117,0.08)",
  Safety: "rgba(212,83,126,0.08)",
  Advanced: "rgba(127,119,221,0.08)",
  Sport: "rgba(55,138,221,0.08)",
};

const FREE_TRICK_LIMIT = 5;

export default function TricksScreen() {
  const {
    dog,
    setDog,
    completedMissions,
    addCompletedMission,
    removeCompletedMission,
    isPro,
  } = useStore();
  const [tricks, setTricks] = useState<Trick[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Free trick IDs = first N by min_level (regardless of category filter)
  const freeTrickIds = new Set(tricks.slice(0, FREE_TRICK_LIMIT).map((t) => t.id));

  const categories = ["All", "Basic", "Fun", "Safety", "Advanced", "Sport"];

  useEffect(() => {
    loadTricks();
  }, []);

  const loadTricks = async () => {
    try {
      const { data, error } = await supabase
        .from("tricks")
        .select("*")
        .order("min_level", { ascending: true });
      if (error) throw error;
      setTricks(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTricks =
    selectedCategory === "All"
      ? tricks
      : tricks.filter((t) => t.category === selectedCategory);
  const isLocked = (trick: Trick) => (dog ? trick.min_level > dog.level : true);
  const isProLocked = (trick: Trick) => !isPro && !freeTrickIds.has(trick.id);

  const handleTrickPress = async (trick: Trick) => {
    if (isLocked(trick)) return;
    if (isProLocked(trick)) {
      router.push("/paywall" as any);
      return;
    }
    const done = completedMissions.includes(trick.id);

    if (done) {
      // Undo — yeşili kaldır + XP düşür
      if (!dog) return;
      const newXP = Math.max(0, dog.total_xp - trick.xp_reward);
      const newLevel = computeLevel(newXP);
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
      setExpandedId(null);
    } else {
      // Expand or go to session
      setExpandedId(expandedId === trick.id ? null : trick.id);
    }
  };

  const renderDifficulty = (level: number) =>
    [1, 2, 3, 4, 5].map((i) => (
      <View
        key={i}
        style={[styles.diffDot, i <= level ? styles.diffOn : styles.diffOff]}
      />
    ));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.pawGold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Trick Library</Text>
        <Text style={styles.subtitle}>
          {dog?.name ?? "Your dog"} · Level {dog?.level ?? 1} ·{" "}
          {tricks.filter((t) => !isLocked(t)).length} unlocked
        </Text>
      </View>

      {/* ── Category filter ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive,
              ]}
            >
              {cat === "All" ? "✨ All" : `${CATEGORY_ICONS[cat]} ${cat}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Tricks list ── */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredTricks.map((trick) => {
          const locked = isLocked(trick);
          const proLocked = !locked && isProLocked(trick);
          const anyLock = locked || proLocked;
          const expanded = expandedId === trick.id;
          const done = completedMissions.includes(trick.id);

          return (
            <TouchableOpacity
              key={trick.id}
              style={[
                styles.trickCard,
                anyLock && styles.trickCardLocked,
                done && styles.trickCardDone,
                {
                  backgroundColor: anyLock
                    ? "rgba(255,255,255,0.02)"
                    : done
                      ? "rgba(29,158,117,0.06)"
                      : (CATEGORY_COLORS[trick.category] ??
                        "rgba(255,255,255,0.04)"),
                },
              ]}
              onPress={() => handleTrickPress(trick)}
              activeOpacity={locked ? 1 : 0.7}
            >
              <View style={styles.trickHeader}>
                <View style={styles.trickLeft}>
                  <Text style={styles.trickIcon}>
                    {anyLock
                      ? "🔒"
                      : done
                        ? "✅"
                        : (CATEGORY_ICONS[trick.category] ?? "🐾")}
                  </Text>
                  <View>
                    <Text
                      style={[
                        styles.trickName,
                        anyLock && styles.trickNameLocked,
                      ]}
                    >
                      {trick.name}
                    </Text>
                    <View style={styles.diffRow}>
                      {renderDifficulty(trick.difficulty)}
                    </View>
                  </View>
                </View>
                <View style={styles.trickRight}>
                  <View style={[styles.xpPill, done && styles.xpPillDone]}>
                    <Text
                      style={[styles.xpPillText, done && styles.xpPillTextDone]}
                    >
                      {done
                        ? `−${trick.xp_reward} XP to undo`
                        : `+${trick.xp_reward} XP`}
                    </Text>
                  </View>
                  {locked && (
                    <Text style={styles.lockLabel}>Lv.{trick.min_level}</Text>
                  )}
                  {proLocked && (
                    <View style={styles.proPill}>
                      <Text style={styles.proPillText}>PRO</Text>
                    </View>
                  )}
                  {!anyLock && !done && (
                    <Text style={styles.expandIcon}>
                      {expanded ? "▲" : "▼"}
                    </Text>
                  )}
                  {done && <Text style={styles.undoHint}>Tap to undo</Text>}
                </View>
              </View>

              {!anyLock && !done && (
                <Text style={styles.trickDesc}>{trick.description}</Text>
              )}

              {/* Steps — expanded */}
              {expanded && !anyLock && !done && (
                <View style={styles.stepsContainer}>
                  <Text style={styles.stepsTitle}>How to teach it:</Text>
                  {trick.steps.map((step, index) => (
                    <View key={index} style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.practiceBtn}
                    onPress={() =>
                      router.push(
                        `/session?trickId=${trick.id}&trickName=${encodeURIComponent(trick.name)}&trickDesc=${encodeURIComponent(trick.description)}&trickXp=${trick.xp_reward}&trickSteps=${encodeURIComponent(JSON.stringify(trick.steps))}` as any,
                      )
                    }
                  >
                    <Text style={styles.practiceBtnText}>
                      Practice this trick → +{trick.xp_reward} XP
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {locked && (
                <Text style={styles.lockDesc}>
                  Reach Level {trick.min_level} to unlock this trick
                </Text>
              )}
              {proLocked && (
                <Text style={styles.lockDesc}>
                  Unlock all 12 tricks with Pawlo Pro · tap to upgrade
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backText: { color: C.textSecondary, fontSize: 14, marginBottom: 12 },
  title: { color: C.text, fontSize: 24, fontWeight: "700", marginBottom: 4 },
  subtitle: { color: C.textSecondary, fontSize: 13 },

  categoryScroll: { maxHeight: 52 },
  categoryContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  categoryChip: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  categoryChipActive: {
    backgroundColor: "rgba(250,199,117,0.15)",
    borderColor: Palette.pawGold,
  },
  categoryChipText: { color: C.textSecondary, fontSize: 13 },
  categoryChipTextActive: { color: C.accent, fontWeight: "500" },

  list: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: 12 },
  trickCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 10,
  },
  trickCardLocked: { borderColor: "rgba(255,255,255,0.04)" },
  trickCardDone: { borderColor: "rgba(29,158,117,0.25)" },
  trickHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  trickLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  trickIcon: { fontSize: 28 },
  trickName: {
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  trickNameLocked: { color: C.textSecondary },
  diffRow: { flexDirection: "row", gap: 4 },
  diffDot: { width: 8, height: 8, borderRadius: 4 },
  diffOn: { backgroundColor: Palette.pawGold },
  diffOff: { backgroundColor: C.border },
  trickRight: { alignItems: "flex-end", gap: 4 },
  xpPill: {
    backgroundColor: "rgba(250,199,117,0.15)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  xpPillDone: { backgroundColor: "rgba(29,158,117,0.15)" },
  xpPillText: { color: C.xp, fontSize: 11, fontWeight: "600" },
  xpPillTextDone: { color: C.success },
  lockLabel: { color: C.textSecondary, fontSize: 11 },
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
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  expandIcon: { color: C.textSecondary, fontSize: 12 },
  undoHint: { color: C.success, fontSize: 11 },
  trickDesc: { color: C.textSecondary, fontSize: 13, lineHeight: 20 },
  lockDesc: { color: "rgba(136,146,164,0.5)", fontSize: 12, marginTop: 4 },
  stepsContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  stepsTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(250,199,117,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { color: C.xp, fontSize: 11, fontWeight: "700" },
  stepText: { color: C.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  practiceBtn: {
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  practiceBtnText: {
    color: Palette.questNight,
    fontSize: 14,
    fontWeight: "700",
  },
});
