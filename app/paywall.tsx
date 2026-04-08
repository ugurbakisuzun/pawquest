import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";
import {
  fetchOffering,
  isPurchasesConfigured,
  purchasePackage,
  restorePurchases,
} from "../lib/purchases";
import { useStore } from "../lib/store";

const C = Colors.dark;

interface PaywallFeature {
  emoji: string;
  free: string;
  pro: string;
}

const FEATURES: PaywallFeature[] = [
  { emoji: "🐾", free: "1 program", pro: "All 4 programs" },
  { emoji: "🎯", free: "5 tricks", pro: "All 12 tricks" },
  { emoji: "🐶", free: "Pawlo · 5 chats/day", pro: "Pawlo · unlimited" },
  { emoji: "🏆", free: "Levels & badges", pro: "Levels & badges" },
  { emoji: "🔥", free: "Streaks", pro: "Streaks" },
  { emoji: "🚶", free: "Walks & health", pro: "Walks & health" },
];

export default function PaywallScreen() {
  const { isPro, loadProStatus, setProForDev } = useStore();
  const [pkg, setPkg] = useState<any>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isPurchasesConfigured()) {
        setLoadingOffer(false);
        return;
      }
      const offering = await fetchOffering();
      setPkg(offering?.monthly ?? offering?.availablePackages?.[0] ?? null);
      setLoadingOffer(false);
    })();
  }, []);

  const handleBuy = async () => {
    if (!pkg) {
      Alert.alert(
        "Coming soon",
        "Pawlo Pro will be available shortly. We're putting the finishing touches on the store integration!",
      );
      return;
    }
    setPurchasing(true);
    const result = await purchasePackage(pkg);
    setPurchasing(false);
    if (result.ok && result.isPro) {
      await loadProStatus();
      Alert.alert("Welcome to Pawlo Pro! 🎉", "All programs unlocked. Enjoy!", [
        { text: "Let's go", onPress: () => router.back() },
      ]);
      return;
    }
    if (!result.ok && !result.cancelled) {
      Alert.alert("Couldn't complete purchase", result.error ?? "Try again.");
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.ok && result.isPro) {
      await loadProStatus();
      Alert.alert("Welcome back!", "Your Pawlo Pro is restored.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } else if (result.ok) {
      Alert.alert("Nothing to restore", "We couldn't find an active subscription on this account.");
    } else if (!result.cancelled) {
      Alert.alert("Couldn't restore", result.error ?? "Try again.");
    }
  };

  // Price string from RC package, fallback to placeholder
  const priceString = pkg?.product?.priceString ?? "£4.99/mo";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.crown}>
            <Text style={styles.crownEmoji}>👑</Text>
          </View>
          <Text style={styles.heroEyebrow}>PAWLO PRO</Text>
          <Text style={styles.heroTitle}>
            Unleash{"\n"}<Text style={styles.gold}>Pawlo's full powers.</Text>
          </Text>
          <Text style={styles.heroSub}>
            All programs. All tricks. Unlimited Pawlo. Just £4.99/month.
          </Text>
        </View>

        {/* Feature comparison */}
        <View style={styles.compareCard}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareCol1} />
            <Text style={styles.compareCol}>Free</Text>
            <Text style={[styles.compareCol, styles.compareColPro]}>Pro</Text>
          </View>
          {FEATURES.map((f) => (
            <View key={f.emoji} style={styles.compareRow}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <Text style={[styles.featureCell, styles.featureCellFree]}>{f.free}</Text>
              <Text style={[styles.featureCell, styles.featureCellPro]}>{f.pro}</Text>
            </View>
          ))}
        </View>

        {/* Buy button */}
        <TouchableOpacity
          style={[styles.buyBtn, (purchasing || loadingOffer) && { opacity: 0.6 }]}
          onPress={handleBuy}
          disabled={purchasing || loadingOffer || isPro}
        >
          {loadingOffer ? (
            <ActivityIndicator color={Palette.questNight} />
          ) : isPro ? (
            <Text style={styles.buyBtnText}>You're already Pro 🎉</Text>
          ) : (
            <>
              <Text style={styles.buyBtnText}>
                {purchasing ? "Processing..." : "Start Pawlo Pro"}
              </Text>
              <Text style={styles.buyBtnPrice}>{priceString}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.fineprint}>
          Cancel anytime in your App Store settings. Subscription auto-renews monthly until cancelled.
        </Text>

        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={restoring}>
          <Text style={styles.restoreText}>
            {restoring ? "Restoring..." : "Restore purchases"}
          </Text>
        </TouchableOpacity>

        {__DEV__ && (
          <View style={styles.devCard}>
            <Text style={styles.devTitle}>DEV ONLY</Text>
            <TouchableOpacity
              style={styles.devToggle}
              onPress={() => setProForDev(!isPro)}
            >
              <Text style={styles.devToggleText}>
                Toggle Pro: currently {isPro ? "ON ✅" : "OFF"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  closeText: { color: C.text, fontSize: 18, fontWeight: "600" },

  hero: { alignItems: "center", paddingTop: 16, paddingHorizontal: Spacing.xl, marginBottom: 28 },
  crown: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(250,199,117,0.18)",
    borderWidth: 2, borderColor: Palette.pawGold,
    alignItems: "center", justifyContent: "center", marginBottom: 18,
  },
  crownEmoji: { fontSize: 42 },
  heroEyebrow: {
    color: Palette.pawGold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  heroTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  gold: { color: Palette.pawGold },
  heroSub: {
    color: C.textSecondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },

  compareCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 24,
  },
  compareHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 4,
  },
  compareCol1: { width: 32 },
  compareCol: {
    flex: 1,
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
  },
  compareColPro: { color: Palette.pawGold },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  featureEmoji: { width: 32, fontSize: 18, textAlign: "center" },
  featureCell: { flex: 1, fontSize: 13, textAlign: "center" },
  featureCellFree: { color: C.textSecondary },
  featureCellPro: { color: C.text, fontWeight: "700" },

  buyBtn: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg,
    paddingVertical: 18,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    shadowColor: Palette.pawGold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buyBtnText: { color: Palette.questNight, fontSize: 16, fontWeight: "800" },
  buyBtnPrice: {
    color: Palette.questNight,
    fontSize: 14,
    fontWeight: "700",
    opacity: 0.7,
  },
  fineprint: {
    color: C.textMuted,
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
    marginTop: 12,
    lineHeight: 16,
  },
  restoreBtn: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  restoreText: { color: C.textSecondary, fontSize: 13, textDecorationLine: "underline" },

  // Dev panel
  devCard: {
    marginTop: 32,
    marginHorizontal: Spacing.xl,
    backgroundColor: "rgba(231,111,81,0.1)",
    borderWidth: 1,
    borderColor: "rgba(231,111,81,0.4)",
    borderRadius: Radius.lg,
    padding: 14,
  },
  devTitle: {
    color: "#E76F51",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  devToggle: {
    backgroundColor: "rgba(231,111,81,0.18)",
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  devToggleText: { color: "#E76F51", fontSize: 13, fontWeight: "700" },
});
