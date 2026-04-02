import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius } from "../constants/theme";
import { getLevelInfo } from "../lib/store";

const C = Colors.dark;

export default function LevelUpScreen() {
  const params = useLocalSearchParams();
  const newLevel = Number(params.level) || 2;
  const newXP = Number(params.xp) || 0;
  const dogName = (params.name as string) || "Your dog";
  const levelInfo = getLevelInfo(newXP);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const REWARDS = [
    { icon: "⭐", value: `${newXP} XP`, label: "Total XP" },
    { icon: "🏅", value: `Level ${newLevel}`, label: "New Level" },
    { icon: "🐾", value: levelInfo.title, label: "Title" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.glowBg} />

      {["🎉", "⭐", "🏅", "✨", "🎊", "🐾"].map((emoji, i) => (
        <Text
          key={i}
          style={[
            styles.confetti,
            {
              left: `${10 + i * 15}%` as any,
              top: `${5 + (i % 3) * 8}%` as any,
              fontSize: 18 + (i % 3) * 4,
            },
          ]}
        >
          {emoji}
        </Text>
      ))}

      <View style={styles.content}>
        {/* ── Level badge ── */}
        <Animated.View
          style={[styles.levelBadge, { transform: [{ scale: scaleAnim }] }]}
        >
          <Text style={styles.levelNum}>{newLevel}</Text>
          <Text style={styles.levelText}>LEVEL UP</Text>
        </Animated.View>

        {/* ── Title ── */}
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <Text style={styles.title}>{dogName} leveled up! 🎉</Text>
          <Text style={styles.subtitle}>
            Now a <Text style={styles.subtitleAccent}>{levelInfo.title}</Text>.
            {"\n"}Keep training to unlock more tricks!
          </Text>
        </Animated.View>

        {/* ── Rewards ── */}
        <Animated.View
          style={[
            styles.rewardsRow,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {REWARDS.map((reward) => (
            <View key={reward.label} style={styles.rewardChip}>
              <Text style={styles.rewardIcon}>{reward.icon}</Text>
              <Text style={styles.rewardVal} numberOfLines={1}>
                {reward.value}
              </Text>
              <Text style={styles.rewardLbl}>{reward.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Buttons ── */}
        <Animated.View style={[styles.buttons, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace("/dashboard" as any)}
          >
            <Text style={styles.btnPrimaryText}>Continue training →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => router.replace("/dashboard" as any)}
          >
            <Text style={styles.btnGhostText}>View leaderboard →</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
  },
  glowBg: {
    position: "absolute",
    top: "15%",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(250,199,117,0.08)",
    alignSelf: "center",
  },
  confetti: { position: "absolute", opacity: 0.6 },
  content: { alignItems: "center", paddingHorizontal: 32, width: "100%" },
  levelBadge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Palette.pawGold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: Palette.pawGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  levelNum: {
    color: Palette.questNight,
    fontSize: 52,
    fontWeight: "800",
    lineHeight: 56,
  },
  levelText: {
    color: "rgba(15,11,46,0.65)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  subtitleAccent: { color: C.accent, fontWeight: "700" },
  rewardsRow: { flexDirection: "row", gap: 10, marginBottom: 40 },
  rewardChip: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: "center",
    minWidth: 90,
    maxWidth: 110,
  },
  rewardIcon: { fontSize: 24, marginBottom: 6 },
  rewardVal: { color: C.xp, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  rewardLbl: { color: C.textSecondary, fontSize: 11 },
  buttons: { width: "100%", gap: 10 },
  btnPrimary: {
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: Palette.questNight,
    fontSize: 16,
    fontWeight: "700",
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnGhostText: { color: C.textSecondary, fontSize: 14 },
});
