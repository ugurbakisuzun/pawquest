import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.dark;

const BREEDS = [
  { emoji: "🦮", name: "Golden Retriever" },
  { emoji: "🐕", name: "German Shepherd" },
  { emoji: "🐩", name: "Poodle" },
  { emoji: "🐕‍🦺", name: "Labrador" },
  { emoji: "🐾", name: "French Bulldog" },
  { emoji: "🐶", name: "Beagle" },
  { emoji: "🦴", name: "Dachshund" },
  { emoji: "🐕", name: "Maltese" },
  { emoji: "🐩", name: "Yorkshire Terrier" },
  { emoji: "🐾", name: "Shih Tzu" },
  { emoji: "🐶", name: "Chihuahua" },
  { emoji: "✏️", name: "Other breed" },
];

const EXPERIENCE_LEVELS = [
  "Complete beginner",
  "Knows a few basics",
  "Intermediate",
];

export default function SetupScreen() {
  const [dogName, setDogName] = useState("");
  const [dogAge, setDogAge] = useState("");
  const [selectedBreed, setSelectedBreed] = useState("");
  const [customBreed, setCustomBreed] = useState("");
  const [selectedExp, setSelectedExp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setDog = useStore((s) => s.setDog);

  const isOtherBreed = selectedBreed === "Other breed";
  const finalBreed = isOtherBreed ? customBreed : selectedBreed;
  const canContinue = dogName && dogAge && finalBreed && selectedExp;

  const handleContinue = async () => {
    if (!canContinue) return;
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      const { data, error } = await supabase
        .from("dogs")
        .insert({
          owner_id: user.id,
          name: dogName,
          breed: finalBreed,
          age: dogAge,
          experience: selectedExp,
          level: 1,
          total_xp: 0,
          streak_days: 0,
        })
        .select()
        .single();
      if (error) throw error;
      setDog(data);
      router.replace("/dashboard" as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* ── Progress dots ── */}
        <View style={styles.progressRow}>
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={[styles.dot, styles.dotTodo]} />
        </View>

        <Text style={styles.title}>Tell us about{"\n"}your dog 🐶</Text>
        <Text style={styles.subtitle}>
          We'll personalise their training plan.
        </Text>

        {/* ── Name ── */}
        <Text style={styles.label}>DOG'S NAME</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Max, Bella, Charlie…"
          placeholderTextColor={C.textMuted}
          value={dogName}
          onChangeText={setDogName}
        />

        {/* ── Age ── */}
        <Text style={styles.label}>AGE</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 8 months, 2 years…"
          placeholderTextColor={C.textMuted}
          value={dogAge}
          onChangeText={setDogAge}
        />

        {/* ── Breed ── */}
        <Text style={styles.label}>BREED</Text>
        <View style={styles.breedGrid}>
          {BREEDS.map((breed) => (
            <TouchableOpacity
              key={breed.name}
              style={[
                styles.breedCard,
                selectedBreed === breed.name && styles.breedCardSelected,
              ]}
              onPress={() => {
                setSelectedBreed(breed.name);
                setCustomBreed("");
              }}
            >
              <Text style={styles.breedEmoji}>{breed.emoji}</Text>
              <Text
                style={[
                  styles.breedName,
                  selectedBreed === breed.name && styles.breedNameSelected,
                ]}
              >
                {breed.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Other breed text input */}
        {isOtherBreed && (
          <TextInput
            style={[styles.input, styles.otherBreedInput]}
            placeholder="Type your dog's breed…"
            placeholderTextColor={C.textMuted}
            value={customBreed}
            onChangeText={setCustomBreed}
            autoFocus
          />
        )}

        {/* ── Experience ── */}
        <Text style={styles.label}>TRAINING EXPERIENCE</Text>
        {EXPERIENCE_LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.expRow,
              selectedExp === level && styles.expRowSelected,
            ]}
            onPress={() => setSelectedExp(level)}
          >
            <Text
              style={[
                styles.expText,
                selectedExp === level && styles.expTextSelected,
              ]}
            >
              {level}
            </Text>
            {selectedExp === level && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.btnPrimary,
            !canContinue || loading ? styles.btnDisabled : styles.btnEnabled,
          ]}
          onPress={handleContinue}
          disabled={!canContinue || loading}
        >
          {loading ? (
            <ActivityIndicator color={Palette.questNight} />
          ) : (
            <Text
              style={[styles.btnText, !canContinue && styles.btnTextDisabled]}
            >
              {canContinue
                ? `Let's go, ${dogName}! →`
                : "Fill in all fields to continue"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 28,
    paddingTop: 60,
  },
  backBtn: { marginBottom: 20 },
  backText: { color: C.textSecondary, fontSize: 14 },

  progressRow: { flexDirection: "row", gap: 6, marginBottom: 28 },
  dot: { width: 28, height: 4, borderRadius: 2 },
  dotDone: { backgroundColor: Palette.pawGold },
  dotActive: { backgroundColor: Palette.levelPurple },
  dotTodo: { backgroundColor: C.border },

  title: {
    color: C.text,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: { color: C.textSecondary, fontSize: 14, marginBottom: 28 },
  label: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    padding: 14,
    color: C.text,
    fontSize: 15,
    marginBottom: Spacing.xl,
  },
  otherBreedInput: { marginTop: 8 },

  breedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  breedCard: {
    width: "47%",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: "center",
  },
  breedCardSelected: {
    backgroundColor: "rgba(250,199,117,0.1)",
    borderColor: Palette.pawGold,
  },
  breedEmoji: { fontSize: 28, marginBottom: 6 },
  breedName: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  breedNameSelected: { color: C.text },

  expRow: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expRowSelected: {
    backgroundColor: "rgba(250,199,117,0.1)",
    borderColor: Palette.pawGold,
  },
  expText: { color: C.textSecondary, fontSize: 14 },
  expTextSelected: { color: C.text, fontWeight: "500" },
  checkmark: { color: C.accent, fontSize: 16, fontWeight: "700" },

  errorText: {
    color: C.error,
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },

  btnPrimary: {
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 24,
  },
  btnEnabled: { backgroundColor: Palette.pawGold },
  btnDisabled: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  btnText: { color: Palette.questNight, fontSize: 16, fontWeight: "700" },
  btnTextDisabled: { color: C.textMuted },
});
