import { router } from "expo-router";
import {
    Linking,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";

const TERMS_URL = "https://pawlo.so/terms";
const PRIVACY_URL = "https://pawlo.so/privacy";

const C = Colors.dark;

export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.pawCircle}>
          <Text style={styles.pawEmoji}>🐾</Text>
        </View>
        <Text style={styles.title}>
          Train smarter.{"\n"}
          <Text style={styles.titleAccent}>Level up together.</Text>
        </Text>
        <Text style={styles.subtitle}>
          The first gamified dog training app. Earn XP, unlock tricks, climb the
          leaderboard.
        </Text>
      </View>

      {/* ── Pills ── */}
      <View style={styles.pills}>
        {[
          "🏆 XP & Levels",
          "🎯 Daily Missions",
          "🤖 AI Advisor",
          "🐶 200+ Tricks",
        ].map((label) => (
          <View key={label} style={styles.pill}>
            <Text style={styles.pillText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Buttons ── */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push("/signup?mode=signup" as any)}
        >
          <Text style={styles.btnPrimaryText}>Get started — it's free</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnGhost}
          onPress={() => router.push("/signup?mode=login" as any)}
        >
          <Text style={styles.btnGhostText}>I already have an account</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.legal}>
        By continuing you agree to our{" "}
        <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>
          Terms
        </Text>{" "}
        &{" "}
        <Text
          style={styles.legalLink}
          onPress={() => Linking.openURL(PRIVACY_URL)}
        >
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  hero: { flex: 1, alignItems: "center", justifyContent: "center" },
  pawCircle: {
    width: 130,
    height: 130,
    borderRadius: Radius.full,
    backgroundColor: Palette.pawGold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  pawEmoji: { fontSize: 64 },
  title: {
    fontWeight: "800",
    fontSize: 34,
    color: C.text,
    textAlign: "center",
    lineHeight: 42,
    marginBottom: 16,
  },
  titleAccent: { color: C.accent },
  subtitle: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: 40,
  },
  pill: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { color: C.text, fontSize: 13 },
  buttons: { gap: 12, marginBottom: 16 },
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
  legal: { color: C.textMuted, fontSize: 11, textAlign: "center" },
  legalLink: {
    color: C.textSecondary,
    textDecorationLine: "underline",
  },
});
