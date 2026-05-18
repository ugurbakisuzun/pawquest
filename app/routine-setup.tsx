import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";
import { scheduleRoutineReminders } from "../lib/reminders";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { WheelPicker } from "./setup";

const C = Colors.light;
const TOTAL_STEPS = 4;

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const FOOD_TYPES = [
  { id: "dry", label: "Dry Food", emoji: "🥣" },
  { id: "wet", label: "Wet Food", emoji: "🥫" },
  { id: "mixed", label: "Mixed", emoji: "🍲" },
  { id: "home_cooked", label: "Home Cooked", emoji: "🏠" },
];

const WALK_TYPES = [
  { id: "street", label: "Street Walk", emoji: "🏙️" },
  { id: "park", label: "Park Walk", emoji: "🌳" },
  { id: "mixed", label: "Mixed", emoji: "🔀" },
];

export default function RoutineSetupScreen() {
  const { dog, setDog } = useStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Feeding state
  const [mealsPerDay, setMealsPerDay] = useState(2);
  const [foodType, setFoodType] = useState("dry");
  const [mealHours, setMealHours] = useState([8, 18, 12, 7]); // defaults
  const [mealMinutes, setMealMinutes] = useState([0, 0, 0, 0]);

  // Walking state
  const [walksPerDay, setWalksPerDay] = useState(2);
  const [walkType, setWalkType] = useState("mixed");
  const [walkHours, setWalkHours] = useState([9, 17, 13, 20]);
  const [walkMinutes, setWalkMinutes] = useState([0, 0, 0, 0]);

  const dogName = dog?.name ?? "your dog";

  const animateTransition = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const goNext = () => animateTransition(step + 1);
  const goBack = () => { if (step > 1) animateTransition(step - 1); };

  const saveFeedingRoutine = async () => {
    if (!dog) return;
    const times = Array.from({ length: mealsPerDay }, (_, i) =>
      `${HOURS[mealHours[i]]}:${MINUTES[mealMinutes[i]]}`,
    );

    await supabase.from("feeding_routines").upsert({
      dog_id: dog.id,
      meals_per_day: mealsPerDay,
      food_type: foodType,
      meal_times: times,
    }, { onConflict: "dog_id" });

    await scheduleRoutineReminders(dog.id, dog.name, "feeding", times);
    goNext();
  };

  const saveWalkingRoutine = async () => {
    if (!dog) return;
    setSaving(true);
    const times = Array.from({ length: walksPerDay }, (_, i) =>
      `${HOURS[walkHours[i]]}:${MINUTES[walkMinutes[i]]}`,
    );

    await supabase.from("walking_routines").upsert({
      dog_id: dog.id,
      walks_per_day: walksPerDay,
      walk_type: walkType,
      walk_times: times,
    }, { onConflict: "dog_id" });

    await scheduleRoutineReminders(dog.id, dog.name, "walking", times);

    // Mark routine setup complete
    const { data } = await supabase
      .from("dogs")
      .update({ routine_setup_complete: true })
      .eq("id", dog.id)
      .select()
      .single();
    if (data) setDog(data);

    setSaving(false);
    router.replace("/dashboard" as any);
  };

  const skipAll = async () => {
    if (!dog) return;
    const { data } = await supabase
      .from("dogs")
      .update({ routine_setup_complete: true })
      .eq("id", dog.id)
      .select()
      .single();
    if (data) setDog(data);
    router.replace("/dashboard" as any);
  };

  const setMealHour = (index: number, val: number) => {
    setMealHours((prev) => { const n = [...prev]; n[index] = val; return n; });
  };
  const setMealMinute = (index: number, val: number) => {
    setMealMinutes((prev) => { const n = [...prev]; n[index] = val; return n; });
  };
  const setWalkHour = (index: number, val: number) => {
    setWalkHours((prev) => { const n = [...prev]; n[index] = val; return n; });
  };
  const setWalkMinute = (index: number, val: number) => {
    setWalkMinutes((prev) => { const n = [...prev]; n[index] = val; return n; });
  };

  const ordinal = (i: number) => {
    const labels = ["1st", "2nd", "3rd", "4th"];
    return labels[i] ?? `${i + 1}th`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        {step > 1 ? (
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
        <Text style={styles.headerTitle}>Set up routines</Text>
        <TouchableOpacity onPress={skipAll}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Step dots */}
      <View style={styles.dots}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            style={[
              styles.dot,
              s < step && styles.dotDone,
              s === step && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* ═══ Step 1: Feeding Count & Type ═══ */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>🍗</Text>
              <Text style={styles.title}>Feeding Routine</Text>
              <Text style={styles.subtitle}>How many times a day do you feed {dogName}?</Text>

              <View style={styles.countRow}>
                {[1, 2, 3, 4].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.countBtn, mealsPerDay === n && styles.countBtnActive]}
                    onPress={() => setMealsPerDay(n)}
                  >
                    <Text style={[styles.countText, mealsPerDay === n && styles.countTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>What type of food?</Text>
              <View style={styles.typeGrid}>
                {FOOD_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeCard, foodType === t.id && styles.typeCardActive]}
                    onPress={() => setFoodType(t.id)}
                  >
                    <Text style={styles.typeEmoji}>{t.emoji}</Text>
                    <Text style={[styles.typeLabel, foodType === t.id && styles.typeLabelActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ Step 2: Feeding Times ═══ */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>⏰</Text>
              <Text style={styles.title}>Feeding Times</Text>
              <Text style={styles.subtitle}>When do you feed {dogName}?</Text>

              {Array.from({ length: mealsPerDay }, (_, i) => (
                <View key={i} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>{ordinal(i)} Meal</Text>
                  <View style={styles.timePickers}>
                    <WheelPicker
                      data={HOURS}
                      selectedIndex={mealHours[i]}
                      onSelect={(v) => setMealHour(i, v)}
                      width={60}
                    />
                    <Text style={styles.timeColon}>:</Text>
                    <WheelPicker
                      data={MINUTES}
                      selectedIndex={mealMinutes[i]}
                      onSelect={(v) => setMealMinute(i, v)}
                      width={60}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.saveBtn} onPress={saveFeedingRoutine}>
                <Text style={styles.saveBtnText}>Save & continue →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ Step 3: Walking Count & Type ═══ */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>🚶</Text>
              <Text style={styles.title}>Walking Routine</Text>
              <Text style={styles.subtitle}>How many walks per day for {dogName}?</Text>

              <View style={styles.countRow}>
                {[1, 2, 3, 4].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.countBtn, walksPerDay === n && styles.countBtnActive]}
                    onPress={() => setWalksPerDay(n)}
                  >
                    <Text style={[styles.countText, walksPerDay === n && styles.countTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Walk type?</Text>
              <View style={styles.typeGrid}>
                {WALK_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeCard, walkType === t.id && styles.typeCardActive]}
                    onPress={() => setWalkType(t.id)}
                  >
                    <Text style={styles.typeEmoji}>{t.emoji}</Text>
                    <Text style={[styles.typeLabel, walkType === t.id && styles.typeLabelActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ Step 4: Walking Times ═══ */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>⏰</Text>
              <Text style={styles.title}>Walking Times</Text>
              <Text style={styles.subtitle}>When do you walk {dogName}?</Text>

              {Array.from({ length: walksPerDay }, (_, i) => (
                <View key={i} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>{ordinal(i)} Walk</Text>
                  <View style={styles.timePickers}>
                    <WheelPicker
                      data={HOURS}
                      selectedIndex={walkHours[i]}
                      onSelect={(v) => setWalkHour(i, v)}
                      width={60}
                    />
                    <Text style={styles.timeColon}>:</Text>
                    <WheelPicker
                      data={MINUTES}
                      selectedIndex={walkMinutes[i]}
                      onSelect={(v) => setWalkMinute(i, v)}
                      width={60}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={saveWalkingRoutine}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? "Saving..." : "Save & finish ✓"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  backText: { color: C.text, fontSize: 18, fontWeight: "600" },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: "700" },
  skipText: { color: C.textMuted, fontSize: 14 },

  dots: {
    flexDirection: "row", justifyContent: "center", gap: 8,
    paddingVertical: 12,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.border,
  },
  dotDone: { backgroundColor: Palette.streakGreen },
  dotActive: { backgroundColor: Palette.levelPurple, width: 24 },

  content: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 12 },
  stepContent: { alignItems: "center" },

  emoji: { fontSize: 48, marginBottom: 12 },
  title: {
    color: C.text, fontSize: 24, fontWeight: "800",
    textAlign: "center", marginBottom: 8,
  },
  subtitle: {
    color: C.textSecondary, fontSize: 15, textAlign: "center",
    lineHeight: 22, marginBottom: 28,
  },

  // Count picker (1-4)
  countRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  countBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  countBtnActive: {
    backgroundColor: Palette.levelPurple, borderColor: Palette.levelPurple,
  },
  countText: { color: C.text, fontSize: 20, fontWeight: "700" },
  countTextActive: { color: "#fff" },

  // Type cards (food / walk)
  sectionLabel: {
    color: C.text, fontSize: 15, fontWeight: "600",
    alignSelf: "flex-start", marginBottom: 12,
  },
  typeGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28,
    width: "100%",
  },
  typeCard: {
    flexBasis: "47%", flexGrow: 1,
    paddingVertical: 16, paddingHorizontal: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, alignItems: "center", gap: 6,
  },
  typeCardActive: {
    borderColor: Palette.levelPurple, backgroundColor: "rgba(127,119,221,0.1)",
  },
  typeEmoji: { fontSize: 24 },
  typeLabel: { color: C.text, fontSize: 13, fontWeight: "600" },
  typeLabelActive: { color: Palette.levelPurple },

  // Time picker rows
  timeRow: {
    width: "100%", marginBottom: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 16,
  },
  timeLabel: {
    color: C.text, fontSize: 15, fontWeight: "700",
    marginBottom: 8, textAlign: "center",
  },
  timePickers: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4,
  },
  timeColon: { color: C.text, fontSize: 24, fontWeight: "700", marginHorizontal: 4 },

  // Buttons
  nextBtn: {
    width: "100%", backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg, paddingVertical: 18, alignItems: "center",
  },
  nextBtnText: { color: Palette.questNight, fontSize: 16, fontWeight: "800" },
  saveBtn: {
    width: "100%", backgroundColor: Palette.streakGreen,
    borderRadius: Radius.lg, paddingVertical: 18, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
