import DateTimePicker from "@react-native-community/datetimepicker";
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

const C = Colors.light;

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

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function RoutineSetupScreen() {
  const { dog, setDog } = useStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Feeding state
  const [mealsPerDay, setMealsPerDay] = useState(2);
  const [foodType, setFoodType] = useState("dry");
  const [mealTimes, setMealTimes] = useState([
    new Date(2026, 0, 1, 8, 0),
    new Date(2026, 0, 1, 18, 0),
    new Date(2026, 0, 1, 12, 0),
    new Date(2026, 0, 1, 7, 0),
  ]);

  // Walking state
  const [walksPerDay, setWalksPerDay] = useState(2);
  const [walkType, setWalkType] = useState("mixed");
  const [walkTimes, setWalkTimes] = useState([
    new Date(2026, 0, 1, 9, 0),
    new Date(2026, 0, 1, 17, 0),
    new Date(2026, 0, 1, 13, 0),
    new Date(2026, 0, 1, 20, 0),
  ]);

  // Time picker visibility
  const [activeTimePicker, setActiveTimePicker] = useState<string | null>(null);

  const dogName = dog?.name ?? "your dog";

  const animateTransition = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const goNext = () => animateTransition(step + 1);
  const goBack = () => { if (step > 1) animateTransition(step - 1); };

  const handleTimeChange = (key: string, _: any, selectedDate?: Date) => {
    setActiveTimePicker(null);
    if (!selectedDate) return;
    const [type, indexStr] = key.split("-");
    const index = Number(indexStr);
    if (type === "meal") {
      setMealTimes((prev) => { const n = [...prev]; n[index] = selectedDate; return n; });
    } else {
      setWalkTimes((prev) => { const n = [...prev]; n[index] = selectedDate; return n; });
    }
  };

  const saveFeedingRoutine = async () => {
    if (!dog) return;
    const times = Array.from({ length: mealsPerDay }, (_, i) =>
      formatTime(mealTimes[i].getHours(), mealTimes[i].getMinutes()),
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
      formatTime(walkTimes[i].getHours(), walkTimes[i].getMinutes()),
    );

    await supabase.from("walking_routines").upsert({
      dog_id: dog.id,
      walks_per_day: walksPerDay,
      walk_type: walkType,
      walk_times: times,
    }, { onConflict: "dog_id" });

    await scheduleRoutineReminders(dog.id, dog.name, "walking", times);

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

  const ordinal = (i: number) => ["1st", "2nd", "3rd", "4th"][i] ?? `${i + 1}th`;

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
            style={[styles.dot, s < step && styles.dotDone, s === step && styles.dotActive]}
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
                    <Text style={[styles.countText, mealsPerDay === n && styles.countTextActive]}>{n}</Text>
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
                    <Text style={[styles.typeLabel, foodType === t.id && styles.typeLabelActive]}>{t.label}</Text>
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

              {Array.from({ length: mealsPerDay }, (_, i) => {
                const key = `meal-${i}`;
                return (
                  <View key={i}>
                    <TouchableOpacity
                      style={styles.timeCard}
                      onPress={() => setActiveTimePicker(activeTimePicker === key ? null : key)}
                    >
                      <Text style={styles.timeCardLabel}>{ordinal(i)} Meal</Text>
                      <Text style={styles.timeCardValue}>
                        {formatTime(mealTimes[i].getHours(), mealTimes[i].getMinutes())}
                      </Text>
                    </TouchableOpacity>
                    {activeTimePicker === key && (
                      <DateTimePicker
                        value={mealTimes[i]}
                        mode="time"
                        display="spinner"
                        minuteInterval={5}
                        onChange={(e, d) => handleTimeChange(key, e, d)}
                      />
                    )}
                  </View>
                );
              })}

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
                    <Text style={[styles.countText, walksPerDay === n && styles.countTextActive]}>{n}</Text>
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
                    <Text style={[styles.typeLabel, walkType === t.id && styles.typeLabelActive]}>{t.label}</Text>
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

              {Array.from({ length: walksPerDay }, (_, i) => {
                const key = `walk-${i}`;
                return (
                  <View key={i}>
                    <TouchableOpacity
                      style={styles.timeCard}
                      onPress={() => setActiveTimePicker(activeTimePicker === key ? null : key)}
                    >
                      <Text style={styles.timeCardLabel}>{ordinal(i)} Walk</Text>
                      <Text style={styles.timeCardValue}>
                        {formatTime(walkTimes[i].getHours(), walkTimes[i].getMinutes())}
                      </Text>
                    </TouchableOpacity>
                    {activeTimePicker === key && (
                      <DateTimePicker
                        value={walkTimes[i]}
                        mode="time"
                        display="spinner"
                        minuteInterval={5}
                        onChange={(e, d) => handleTimeChange(key, e, d)}
                      />
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={saveWalkingRoutine}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save & finish ✓"}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  backText: { color: C.text, fontSize: 18, fontWeight: "600" },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: "700" },
  skipText: { color: C.textMuted, fontSize: 14 },

  dots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotDone: { backgroundColor: Palette.streakGreen },
  dotActive: { backgroundColor: Palette.levelPurple, width: 24 },

  content: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 12 },
  stepContent: { alignItems: "center" },

  emoji: { fontSize: 48, marginBottom: 12 },
  title: { color: C.text, fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  subtitle: { color: C.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 28 },

  countRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  countBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  countBtnActive: { backgroundColor: Palette.levelPurple, borderColor: Palette.levelPurple },
  countText: { color: C.text, fontSize: 20, fontWeight: "700" },
  countTextActive: { color: "#fff" },

  sectionLabel: { color: C.text, fontSize: 15, fontWeight: "600", alignSelf: "flex-start", marginBottom: 12 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28, width: "100%" },
  typeCard: {
    flexBasis: "47%", flexGrow: 1,
    paddingVertical: 16, paddingHorizontal: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, alignItems: "center", gap: 6,
  },
  typeCardActive: { borderColor: Palette.levelPurple, backgroundColor: "rgba(127,119,221,0.1)" },
  typeEmoji: { fontSize: 24 },
  typeLabel: { color: C.text, fontSize: 13, fontWeight: "600" },
  typeLabelActive: { color: Palette.levelPurple },

  // Time card (tap to open native picker)
  timeCard: {
    width: "100%", marginBottom: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  timeCardLabel: { color: C.text, fontSize: 15, fontWeight: "700" },
  timeCardValue: { color: Palette.levelPurple, fontSize: 24, fontWeight: "800" },

  nextBtn: {
    width: "100%", backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg, paddingVertical: 18, alignItems: "center",
  },
  nextBtnText: { color: Palette.questNight, fontSize: 16, fontWeight: "800" },
  saveBtn: {
    width: "100%", backgroundColor: Palette.streakGreen,
    borderRadius: Radius.lg, paddingVertical: 18, alignItems: "center", marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
