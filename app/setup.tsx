import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { Colors, Palette, Radius } from "../constants/theme";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.dark;
const { width: SCREEN_W } = Dimensions.get("window");

// ─── Data ────────────────────────────────────────────────────────────────────

export const POPULAR_BREEDS = [
  "Mix / Mixed Breed",
  "Golden Retriever",
  "Labrador Retriever",
  "German Shepherd",
  "French Bulldog",
  "Poodle",
  "Beagle",
  "Bulldog",
  "Dachshund",
  "Yorkshire Terrier",
  "Border Collie",
  "Maltese",
  "Shih Tzu",
  "Chihuahua",
  "Cavalier King Charles",
  "Cocker Spaniel",
  "Pomeranian",
  "Maltipoo",
  "Cockapoo",
  "Goldendoodle",
];

export const ALL_BREEDS = [
  "Affenpinscher","Afghan Hound","Airedale Terrier","Akita","Alaskan Malamute",
  "American Bulldog","American Staffordshire","Australian Shepherd","Basenji",
  "Basset Hound","Bernese Mountain Dog","Bichon Frise","Bloodhound",
  "Boston Terrier","Boxer","Briard","Brittany","Brussels Griffon",
  "Bull Terrier","Cane Corso","Chinese Crested","Chow Chow","Collie",
  "Corgi (Pembroke)","Corgi (Cardigan)","Dalmatian","Doberman Pinscher",
  "English Setter","English Springer Spaniel","Finnish Spitz",
  "Great Dane","Great Pyrenees","Greyhound","Havanese","Husky",
  "Irish Setter","Irish Wolfhound","Italian Greyhound","Jack Russell Terrier",
  "Japanese Chin","Keeshond","Lhasa Apso","Maltichon","Mastiff",
  "Miniature Pinscher","Miniature Schnauzer","Newfoundland","Nova Scotia Duck Tolling",
  "Old English Sheepdog","Papillon","Pekingese","Pit Bull","Portuguese Water Dog",
  "Pug","Rat Terrier","Rhodesian Ridgeback","Rottweiler","Saint Bernard",
  "Samoyed","Scottish Terrier","Shar-Pei","Shetland Sheepdog","Shiba Inu",
  "Staffordshire Bull Terrier","Standard Schnauzer","Tibetan Terrier",
  "Vizsla","Weimaraner","West Highland White Terrier","Whippet",
];

export const TRAINING_GOALS = [
  { id: "separation", label: "Leaving my dog alone", emoji: "🏠" },
  { id: "tricks", label: "Trick training", emoji: "🎯" },
  { id: "leash", label: "Leash walking", emoji: "🦮" },
  { id: "recall", label: "Recall training", emoji: "📣" },
  { id: "potty", label: "Potty training", emoji: "🚽" },
  { id: "biting", label: "Nipping and biting", emoji: "😬" },
  { id: "chewing", label: "Destructive chewing", emoji: "🦴" },
  { id: "jumping", label: "Stop jumping on people", emoji: "🐕" },
  { id: "impulse", label: "Impulse control", emoji: "🧘" },
  { id: "socialization", label: "Socialization", emoji: "🐾" },
];

export const KNOWN_SKILLS = [
  { id: "new_to_training", label: "My dog is new to training", emoji: "🐣" },
  { id: "name", label: "Name recognition", emoji: "👂" },
  { id: "eye_contact", label: "Eye contact", emoji: "👀" },
  { id: "sit", label: "Sit", emoji: "🪑" },
  { id: "down", label: "Down", emoji: "⬇️" },
  { id: "stay", label: "Stay", emoji: "✋" },
  { id: "come", label: "Come", emoji: "🏃" },
  { id: "stand", label: "Stand", emoji: "🧍" },
  { id: "leave_it", label: "Leave it", emoji: "🚫" },
  { id: "drop_it", label: "Drop it", emoji: "🤲" },
  { id: "heel", label: "Heel", emoji: "🦶" },
  { id: "shake", label: "Shake / Paw", emoji: "🤝" },
];

export const LIFESTYLE_OPTIONS = [
  { id: "city", label: "I'm a city person", emoji: "🏙️" },
  { id: "hosting", label: "I like hosting people", emoji: "🏡" },
  { id: "couch", label: "Sometimes I'm a couch potato", emoji: "🛋️" },
  { id: "kids", label: "I have kids", emoji: "👶" },
  { id: "active", label: "I'm very active / outdoorsy", emoji: "🏃" },
  { id: "work_from_home", label: "I work from home", emoji: "💻" },
  { id: "service_dog", label: "My dog is my service dog", emoji: "🦺" },
  { id: "other", label: "Other", emoji: "📝" },
];

export const TIME_OPTIONS = [
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
];

// Map training goals → recommended program slug
const GOAL_TO_PROGRAM: Record<string, string> = {
  separation: "separation-anxiety",
  leash: "leash-walking",
  recall: "recall-training",
  potty: "potty-training",
};

// Programs available for selection in step 11
const PROGRAM_CARDS = [
  {
    slug: "separation-anxiety",
    title: "Separation Anxiety",
    description: "Help your dog feel safe home alone",
    days: 21,
    emoji: "🏠",
    matchGoal: "separation",
  },
  {
    slug: "leash-walking",
    title: "Leash Walking",
    description: "Master the loose leash walk",
    days: 14,
    emoji: "🦮",
    matchGoal: "leash",
  },
  {
    slug: "recall-training",
    title: "Recall Training",
    description: "Build a reliable recall",
    days: 10,
    emoji: "📣",
    matchGoal: "recall",
  },
  {
    slug: "potty-training",
    title: "Potty Training",
    description: "Establish a solid potty routine",
    days: 7,
    emoji: "🚽",
    matchGoal: "potty",
  },
];

const TOTAL_QUIZ_STEPS = 11;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function calcAge(month: number, year: number): string {
  const now = new Date();
  let years = now.getFullYear() - year;
  let months = now.getMonth() - month;
  if (months < 0) { years--; months += 12; }
  if (years > 0 && months > 0) return `${years} year${years > 1 ? "s" : ""}, ${months} month${months > 1 ? "s" : ""}`;
  if (years > 0) return `${years} year${years > 1 ? "s" : ""}`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""}`;
  return "Less than a month";
}

// ─── Scroll Wheel Picker ─────────────────────────────────────────────────────

export const ITEM_HEIGHT = 48;
export const VISIBLE_ITEMS = 5;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

export function WheelPicker({
  data,
  selectedIndex,
  onSelect,
  width = 100,
}: {
  data: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width?: number;
}) {
  const flatListRef = useRef<FlatList>(null);
  const [ready, setReady] = useState(false);

  // Pad data with empty items for center alignment
  const paddedData = ["", "", ...data, "", ""];

  useEffect(() => {
    if (flatListRef.current && !ready) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: selectedIndex * ITEM_HEIGHT,
          animated: false,
        });
        setReady(true);
      }, 100);
    }
  }, [selectedIndex, ready]);

  const onMomentumEnd = useCallback(
    (e: any) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, data.length - 1));
      onSelect(clamped);
    },
    [data.length, onSelect],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const dataIndex = index - 2;
      const isSelected = dataIndex === selectedIndex;
      return (
        <View style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}>
          <Text
            style={[
              styles.wheelText,
              isSelected && styles.wheelTextSelected,
              !item && { color: "transparent" },
            ]}
          >
            {item}
          </Text>
        </View>
      );
    },
    [selectedIndex],
  );

  return (
    <View style={[styles.wheelContainer, { width, height: PICKER_HEIGHT }]}>
      {/* Selection highlight */}
      <View style={styles.wheelHighlight} pointerEvents="none" />
      <FlatList
        ref={flatListRef}
        data={paddedData}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={selectedIndex}
        style={{ height: PICKER_HEIGHT }}
      />
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const [step, setStep] = useState(1);
  const setDog = useStore((s) => s.setDog);

  // Step 1 — Dog name
  const [dogName, setDogName] = useState("");

  // Step 2 — Gender
  const [gender, setGender] = useState<"boy" | "girl" | "">("");

  // Step 3 — Birthday
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 25 }, (_, i) => String(currentYear - i));
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth());
  const [yearIndex, setYearIndex] = useState(1); // default: last year
  const [skipBirthday, setSkipBirthday] = useState(false);

  // Step 4 — Breed
  const [breedSearch, setBreedSearch] = useState("");
  const [selectedBreed, setSelectedBreed] = useState("");

  // Step 5 — Training goals
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Step 6 — Known skills
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Step 7 — Track health & walks
  const [trackHealth, setTrackHealth] = useState<boolean | null>(null);

  // Step 8 — Lifestyle
  const [selectedLifestyle, setSelectedLifestyle] = useState<string[]>([]);

  // Step 9 — Co-parent
  const [hasCoparent, setHasCoparent] = useState<boolean | null>(null);

  // Step 10 — Daily time
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];
  const [hourIndex, setHourIndex] = useState(19); // 19:00
  const [minuteIndex, setMinuteIndex] = useState(0); // :00

  // Step 11 — Selected programs (auto-pre-selected from goals)
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [programsInitialized, setProgramsInitialized] = useState(false);

  // Loading (step 11 - auto)
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");

  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (next: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const goNext = () => {
    const next = step + 1;
    // When entering step 11 for the first time, pre-select programs from goals
    if (next === 11 && !programsInitialized) {
      const recommended = selectedGoals
        .map((g) => GOAL_TO_PROGRAM[g])
        .filter((slug): slug is string => Boolean(slug));
      const unique = Array.from(new Set(recommended));
      setSelectedPrograms(unique.length > 0 ? unique : ["separation-anxiety"]);
      setProgramsInitialized(true);
    }
    animateTransition(next);
  };
  const goBack = () => {
    if (step > 1) animateTransition(step - 1);
    else router.back();
  };

  const togglePrograms = (slug: string) =>
    setSelectedPrograms((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  // Toggle helpers
  const toggleGoal = (id: string) =>
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );

  const toggleSkill = (id: string) => {
    if (id === "new_to_training") {
      setSelectedSkills(["new_to_training"]);
      return;
    }
    setSelectedSkills((prev) => {
      const without = prev.filter((s) => s !== "new_to_training");
      return without.includes(id)
        ? without.filter((s) => s !== id)
        : [...without, id];
    });
  };

  const toggleLifestyle = (id: string) =>
    setSelectedLifestyle((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id],
    );

  // Breed filtering
  const filteredBreeds =
    breedSearch.length > 0
      ? [...POPULAR_BREEDS, ...ALL_BREEDS]
          .filter((b) => b.toLowerCase().includes(breedSearch.toLowerCase()))
          .slice(0, 20)
      : [];

  // Birthday
  const selectedYear = currentYear - yearIndex;
  const ageText = calcAge(monthIndex, selectedYear);

  // Submit
  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    const msgs = [
      `Getting to know ${dogName}...`,
      `Checking ${dogName}'s age & breed...`,
      `Analyzing training goals...`,
      `Building skill assessment...`,
      `Personalizing daily plan...`,
      `Creating ${dogName}'s training journey...`,
      `Almost ready!`,
    ];

    for (let i = 0; i <= 100; i += 2) {
      await new Promise((r) => setTimeout(r, 35));
      setLoadingProgress(i);
      setLoadingText(msgs[Math.min(Math.floor((i / 100) * msgs.length), msgs.length - 1)]);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const birthdayStr = skipBirthday
        ? null
        : `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}-15`;

      const { data, error: dbError } = await supabase
        .from("dogs")
        .insert({
          owner_id: user.id,
          name: dogName,
          breed: selectedBreed,
          age: skipBirthday ? "Unknown" : ageText,
          gender,
          birthday: birthdayStr,
          training_goals: selectedGoals,
          active_program_slugs: selectedPrograms,
          known_skills: selectedSkills,
          daily_minutes: dailyMinutes,
          preferred_time: `${hours[hourIndex]}:${minutes[minuteIndex]}`,
          track_health: trackHealth ?? false,
          lifestyle: selectedLifestyle,
          has_coparent: hasCoparent ?? false,
          level: 1,
          total_xp: 0,
          streak_days: 0,
          experience: selectedSkills.includes("new_to_training")
            ? "Complete beginner"
            : selectedSkills.length <= 3
            ? "Knows a few basics"
            : "Intermediate",
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setDog(data);
      router.replace("/dashboard" as any);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      setLoadingProgress(0);
    }
  };

  // Validators
  const canProceed = (): boolean => {
    switch (step) {
      case 1: return dogName.trim().length > 0;
      case 2: return gender !== "";
      case 3: return true;
      case 4: return selectedBreed.length > 0;
      case 5: return selectedGoals.length > 0;
      case 6: return selectedSkills.length > 0;
      case 7: return trackHealth !== null;
      case 8: return selectedLifestyle.length > 0;
      case 9: return hasCoparent !== null;
      case 10: return true;
      case 11: return selectedPrograms.length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step === TOTAL_QUIZ_STEPS) {
      animateTransition(TOTAL_QUIZ_STEPS + 1);
      setTimeout(() => handleSubmit(), 300);
    } else {
      goNext();
    }
  };

  // ─── Render Steps ──────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── 1: Dog Name ──
      case 1:
        return (
          <View style={styles.stepCenter}>
            <Text style={styles.emoji}>🐶</Text>
            <Text style={styles.stepTitle}>What's your dog's name?</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Type your dog's name..."
              placeholderTextColor={C.textMuted}
              value={dogName}
              onChangeText={setDogName}
              autoFocus
              autoCapitalize="words"
              maxLength={30}
            />
            {dogName.length > 0 && (
              <Text style={styles.goldHint}>Nice to meet you, {dogName}!</Text>
            )}
          </View>
        );

      // ── 2: Gender ──
      case 2:
        return (
          <View style={styles.stepCenter}>
            <Text style={styles.emoji}>
              {gender === "boy" ? "🐕" : gender === "girl" ? "🐩" : "🐾"}
            </Text>
            <Text style={styles.stepTitle}>{dogName} is a:</Text>
            <View style={styles.twoCardRow}>
              {(["boy", "girl"] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.bigCard, gender === g && styles.bigCardSelected]}
                  onPress={() => setGender(g)}
                >
                  <Text style={styles.bigCardEmoji}>{g === "boy" ? "♂️" : "♀️"}</Text>
                  <Text style={[styles.bigCardLabel, gender === g && styles.bigCardLabelSelected]}>
                    {g === "boy" ? "Boy" : "Girl"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // ── 3: Birthday (scroll wheel) ──
      case 3:
        return (
          <View style={styles.stepCenter}>
            <Text style={styles.emoji}>🎂</Text>
            <Text style={styles.stepTitle}>When is {dogName}'s birthday?</Text>

            {!skipBirthday && (
              <>
                <View style={styles.wheelRow}>
                  <WheelPicker
                    data={MONTHS}
                    selectedIndex={monthIndex}
                    onSelect={setMonthIndex}
                    width={100}
                  />
                  <WheelPicker
                    data={years}
                    selectedIndex={yearIndex}
                    onSelect={setYearIndex}
                    width={110}
                  />
                </View>
                <View style={styles.ageBadge}>
                  <Text style={styles.ageBadgeText}>
                    {dogName} is {ageText} old
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.skipLink}
              onPress={() => setSkipBirthday(!skipBirthday)}
            >
              <Text style={styles.skipLinkText}>
                {skipBirthday ? "I know the birthday" : "I don't know"}
              </Text>
            </TouchableOpacity>
          </View>
        );

      // ── 4: Breed ──
      case 4:
        return (
          <View style={[styles.stepTop, { flex: 1 }]}>
            <Text style={styles.stepTitle}>What breed is {dogName}?</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search breed..."
              placeholderTextColor={C.textMuted}
              value={breedSearch}
              onChangeText={(t) => {
                setBreedSearch(t);
                if (selectedBreed && !t) setSelectedBreed("");
              }}
            />

            {selectedBreed ? (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>{selectedBreed}</Text>
                <TouchableOpacity onPress={() => { setSelectedBreed(""); setBreedSearch(""); }}>
                  <Text style={styles.selectedBadgeX}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {breedSearch.length > 0 ? (
                filteredBreeds.length > 0 ? (
                  filteredBreeds.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.listRow, selectedBreed === b && styles.listRowSelected]}
                      onPress={() => { setSelectedBreed(b); setBreedSearch(""); }}
                    >
                      <Text style={[styles.listRowText, selectedBreed === b && styles.listRowTextSelected]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <TouchableOpacity
                    style={styles.addBreedBtn}
                    onPress={() => { setSelectedBreed(breedSearch.trim()); setBreedSearch(""); }}
                  >
                    <Text style={styles.addBreedText}>+ Add "{breedSearch.trim()}" as breed</Text>
                  </TouchableOpacity>
                )
              ) : (
                <>
                  <Text style={styles.sectionLabel}>POPULAR</Text>
                  {POPULAR_BREEDS.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.listRow, selectedBreed === b && styles.listRowSelected]}
                      onPress={() => setSelectedBreed(b)}
                    >
                      <Text style={[styles.listRowText, selectedBreed === b && styles.listRowTextSelected]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>ALL BREEDS</Text>
                  {ALL_BREEDS.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.listRow, selectedBreed === b && styles.listRowSelected]}
                      onPress={() => setSelectedBreed(b)}
                    >
                      <Text style={[styles.listRowText, selectedBreed === b && styles.listRowTextSelected]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        );

      // ── 5: Training Goals ──
      case 5:
        return (
          <View style={[styles.stepTop, { flex: 1 }]}>
            <Text style={styles.stepTitle}>What do you want to{"\n"}focus on?</Text>
            <Text style={styles.stepSub}>Select all that apply</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {TRAINING_GOALS.map((g) => {
                const sel = selectedGoals.includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.multiRow, sel && styles.multiRowSelected]}
                    onPress={() => toggleGoal(g.id)}
                  >
                    <Text style={styles.multiEmoji}>{g.emoji}</Text>
                    <Text style={[styles.multiLabel, sel && styles.multiLabelSelected]}>{g.label}</Text>
                    {sel && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        );

      // ── 6: Known Skills ──
      case 6:
        return (
          <View style={[styles.stepTop, { flex: 1 }]}>
            <Text style={styles.stepTitle}>What does {dogName}{"\n"}already know?</Text>
            <Text style={styles.stepSub}>Select all that apply</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {KNOWN_SKILLS.map((s) => {
                const sel = selectedSkills.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.multiRow,
                      sel && styles.multiRowSelected,
                      s.id === "new_to_training" && { marginBottom: 16 },
                    ]}
                    onPress={() => toggleSkill(s.id)}
                  >
                    <Text style={styles.multiEmoji}>{s.emoji}</Text>
                    <Text style={[styles.multiLabel, sel && styles.multiLabelSelected]}>{s.label}</Text>
                    {sel && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        );

      // ── 7: Track Health & Walks ──
      case 7:
        return (
          <View style={styles.stepCenter}>
            <Text style={styles.emoji}>🏥</Text>
            <Text style={styles.stepTitle}>
              Do you want to track{"\n"}{dogName}'s health & walks?
            </Text>
            <Text style={styles.stepSub}>
              Weight, vaccinations, medications{"\n"}and daily walk tracking
            </Text>
            <View style={styles.twoCardRow}>
              <TouchableOpacity
                style={[styles.bigCard, trackHealth === false && styles.bigCardSelected]}
                onPress={() => setTrackHealth(false)}
              >
                <Text style={styles.bigCardEmoji}>👎</Text>
                <Text style={[styles.bigCardLabel, trackHealth === false && styles.bigCardLabelSelected]}>
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bigCard, trackHealth === true && styles.bigCardSelected]}
                onPress={() => setTrackHealth(true)}
              >
                <Text style={styles.bigCardEmoji}>👍</Text>
                <Text style={[styles.bigCardLabel, trackHealth === true && styles.bigCardLabelSelected]}>
                  Yes
                </Text>
              </TouchableOpacity>
            </View>
            {trackHealth === true && (
              <View style={styles.featureList}>
                {["Track weight over time", "Vaccination reminders", "Medication schedule", "Daily walk log with XP"].map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={styles.featureCheck}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      // ── 8: Lifestyle ──
      case 8:
        return (
          <View style={[styles.stepTop, { flex: 1 }]}>
            <Text style={styles.stepTitle}>What about your{"\n"}lifestyle?</Text>
            <Text style={styles.stepSub}>Select all that apply</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {LIFESTYLE_OPTIONS.map((l) => {
                const sel = selectedLifestyle.includes(l.id);
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.multiRow, sel && styles.multiRowSelected]}
                    onPress={() => toggleLifestyle(l.id)}
                  >
                    <Text style={styles.multiEmoji}>{l.emoji}</Text>
                    <Text style={[styles.multiLabel, sel && styles.multiLabelSelected]}>{l.label}</Text>
                    {sel && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        );

      // ── 9: Co-parent ──
      case 9:
        return (
          <View style={styles.stepCenter}>
            <Text style={styles.emoji}>👨‍👩‍👦</Text>
            <Text style={styles.stepTitle}>
              Do you take care of {dogName}{"\n"}together with someone?
            </Text>
            <View style={styles.twoCardRow}>
              <TouchableOpacity
                style={[styles.bigCard, hasCoparent === false && styles.bigCardSelected]}
                onPress={() => setHasCoparent(false)}
              >
                <Text style={styles.bigCardEmoji}>🙋</Text>
                <Text style={[styles.bigCardLabel, hasCoparent === false && styles.bigCardLabelSelected]}>
                  No, just me
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bigCard, hasCoparent === true && styles.bigCardSelected]}
                onPress={() => setHasCoparent(true)}
              >
                <Text style={styles.bigCardEmoji}>👫</Text>
                <Text style={[styles.bigCardLabel, hasCoparent === true && styles.bigCardLabelSelected]}>
                  Yes
                </Text>
              </TouchableOpacity>
            </View>
            {hasCoparent === true && (
              <View style={styles.featureList}>
                {["Sync all training data", "Share notes and photos", "See your dog's schedule", "Train together, earn XP together"].map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={styles.featureCheck}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      // ── 10: Daily Time & Schedule ──
      case 10:
        return (
          <View style={styles.stepCenter}>
            <Text style={styles.stepTitle}>How much time per day{"\n"}for training?</Text>
            <View style={styles.timeGrid}>
              {TIME_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.timeCard, dailyMinutes === o.value && styles.timeCardSelected]}
                  onPress={() => setDailyMinutes(o.value)}
                >
                  <Text style={[styles.timeCardText, dailyMinutes === o.value && styles.timeCardTextSel]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.stepTitle, { marginTop: 28, fontSize: 22 }]}>
              Best time to train?
            </Text>
            <Text style={styles.stepSub}>We'll send you a reminder</Text>

            <View style={styles.wheelRow}>
              <WheelPicker
                data={hours}
                selectedIndex={hourIndex}
                onSelect={setHourIndex}
                width={90}
              />
              <Text style={styles.timeColon}>:</Text>
              <WheelPicker
                data={minutes}
                selectedIndex={minuteIndex}
                onSelect={setMinuteIndex}
                width={90}
              />
            </View>
          </View>
        );

      // ── 11: Pick programs (pre-selected from goals) ──
      case 11: {
        const recommendedSet = new Set(
          selectedGoals
            .map((g) => GOAL_TO_PROGRAM[g])
            .filter((slug): slug is string => Boolean(slug)),
        );
        return (
          <View style={[styles.stepTop, { flex: 1 }]}>
            <Text style={styles.stepTitle}>
              {dogName}'s plan is{"\n"}customized for you
            </Text>
            <Text style={styles.stepSub}>
              We recommend these programs based on your goals.{"\n"}You can add or remove any.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {PROGRAM_CARDS.map((p) => {
                const sel = selectedPrograms.includes(p.slug);
                const isRecommended = recommendedSet.has(p.slug);
                return (
                  <TouchableOpacity
                    key={p.slug}
                    style={[styles.programCard, sel && styles.programCardSelected]}
                    onPress={() => togglePrograms(p.slug)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.programCardLeft}>
                      <Text style={styles.programCardEmoji}>{p.emoji}</Text>
                    </View>
                    <View style={styles.programCardBody}>
                      <View style={styles.programCardHeader}>
                        <Text
                          style={[
                            styles.programCardTitle,
                            sel && styles.programCardTitleSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {p.title}
                        </Text>
                        {isRecommended && (
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.programCardDesc} numberOfLines={2}>
                        {p.description} · {p.days} days
                      </Text>
                    </View>
                    <View style={[styles.programCheck, sel && styles.programCheckOn]}>
                      {sel && <Text style={styles.programCheckMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        );
      }

      // ── 12: Loading ──
      case TOTAL_QUIZ_STEPS + 1:
        return (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingTitle}>
              Creating {dogName}'s{"\n"}personalized plan
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
              {selectedGoals.map((gId) => {
                const goal = TRAINING_GOALS.find((g) => g.id === gId);
                return goal ? (
                  <View key={gId} style={styles.tag}>
                    <Text style={styles.tagText}>{goal.label}</Text>
                  </View>
                ) : null;
              })}
              {selectedLifestyle.map((lId) => {
                const l = LIFESTYLE_OPTIONS.find((o) => o.id === lId);
                return l ? (
                  <View key={lId} style={[styles.tag, { backgroundColor: "rgba(127,119,221,0.15)" }]}>
                    <Text style={[styles.tagText, { color: Palette.levelPurple }]}>{l.label}</Text>
                  </View>
                ) : null;
              })}
              <View key="breed" style={styles.tag}>
                <Text style={styles.tagText}>{selectedBreed}</Text>
              </View>
            </ScrollView>

            <View style={styles.progressRing}>
              <Text style={styles.progressPercent}>{loadingProgress}%</Text>
              <Text style={styles.progressSub}>{loadingText}</Text>
            </View>

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${loadingProgress}%` }]} />
            </View>

            {error ? (
              <>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleSubmit}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        );
    }
  };

  // ─── Main Render ───────────────────────────────────────────────────────────

  const isLoadingStep = step === TOTAL_QUIZ_STEPS + 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      {!isLoadingStep && (
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_QUIZ_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i < step ? styles.dotDone : i === step - 1 ? styles.dotActive : styles.dotTodo,
                ]}
              />
            ))}
          </View>
          <Text style={styles.stepNum}>{step}/{TOTAL_QUIZ_STEPS}</Text>
        </View>
      )}

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>

      {/* Bottom */}
      {!isLoadingStep && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnOff]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={[styles.nextBtnText, !canProceed() && styles.nextBtnTextOff]}>
              {step === TOTAL_QUIZ_STEPS ? `Create ${dogName}'s plan →` : "Next →"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  backText: { color: C.text, fontSize: 18, fontWeight: "600" },
  progressRow: { flex: 1, flexDirection: "row", gap: 3 },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  dotDone: { backgroundColor: Palette.pawGold },
  dotActive: { backgroundColor: Palette.levelPurple },
  dotTodo: { backgroundColor: C.border },
  stepNum: { color: C.textSecondary, fontSize: 13, fontWeight: "500", minWidth: 32, textAlign: "right" },

  // Content
  content: { flex: 1, paddingHorizontal: 28 },

  // Step layouts
  stepCenter: { flex: 1, paddingTop: 24, alignItems: "center" },
  stepTop: { flex: 1, paddingTop: 16 },

  // Common
  emoji: { fontSize: 56, textAlign: "center", marginBottom: 16 },
  stepTitle: { color: C.text, fontSize: 26, fontWeight: "700", textAlign: "center", lineHeight: 34, marginBottom: 8 },
  stepSub: { color: C.textSecondary, fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  goldHint: { color: Palette.pawGold, fontSize: 15, textAlign: "center", marginTop: 16, fontWeight: "500" },

  // Name input
  nameInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 18, color: C.text,
    fontSize: 20, fontWeight: "600", textAlign: "center",
    marginTop: 20, width: "100%",
  },

  // Two-card row (gender, health, coparent)
  twoCardRow: { flexDirection: "row", gap: 16, marginTop: 24, width: "100%" },
  bigCard: {
    flex: 1, backgroundColor: C.surface, borderWidth: 2, borderColor: C.border,
    borderRadius: Radius.xl, paddingVertical: 28, alignItems: "center",
  },
  bigCardSelected: { borderColor: Palette.pawGold, backgroundColor: "rgba(250,199,117,0.08)" },
  bigCardEmoji: { fontSize: 36, marginBottom: 10 },
  bigCardLabel: { color: C.textSecondary, fontSize: 16, fontWeight: "600", textAlign: "center" },
  bigCardLabelSelected: { color: C.text },

  // Feature list (health yes, coparent yes)
  featureList: { marginTop: 24, width: "100%" },
  featureRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(29,158,117,0.1)", borderRadius: Radius.md,
    paddingVertical: 12, paddingHorizontal: 16, marginBottom: 8,
  },
  featureCheck: { color: Palette.streakGreen, fontSize: 16, fontWeight: "700", marginRight: 12 },
  featureText: { color: C.text, fontSize: 14 },

  // Wheel picker
  wheelRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 20 },
  wheelContainer: { overflow: "hidden", borderRadius: Radius.lg },
  wheelHighlight: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    left: 0, right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(250,199,117,0.12)",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.pawGold,
    zIndex: 1,
  },
  wheelText: { color: C.textMuted, fontSize: 18, fontWeight: "400" },
  wheelTextSelected: { color: C.text, fontSize: 22, fontWeight: "700" },

  ageBadge: {
    backgroundColor: "rgba(29,158,117,0.15)", borderRadius: Radius.full,
    paddingVertical: 10, paddingHorizontal: 20, marginTop: 20,
  },
  ageBadgeText: { color: Palette.streakGreen, fontSize: 15, fontWeight: "600" },
  skipLink: { marginTop: 20, paddingVertical: 8 },
  skipLinkText: { color: C.textSecondary, fontSize: 14, fontWeight: "500", textDecorationLine: "underline" },

  // Search / breed
  searchInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 14, color: C.text, fontSize: 16, marginBottom: 12,
  },
  selectedBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(250,199,117,0.12)", borderWidth: 1, borderColor: Palette.pawGold,
    borderRadius: Radius.lg, padding: 14, marginBottom: 12,
  },
  selectedBadgeText: { color: Palette.pawGold, fontSize: 16, fontWeight: "600" },
  selectedBadgeX: { color: C.textSecondary, fontSize: 18, fontWeight: "600" },
  sectionLabel: { color: Palette.pawGold, fontSize: 12, fontWeight: "600", letterSpacing: 1.2, marginBottom: 8, marginTop: 4 },
  listRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  listRowSelected: { backgroundColor: "rgba(250,199,117,0.08)" },
  listRowText: { color: C.textSecondary, fontSize: 15 },
  listRowTextSelected: { color: C.text, fontWeight: "600" },
  addBreedBtn: { backgroundColor: Palette.pawGold, borderRadius: Radius.lg, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  addBreedText: { color: Palette.questNight, fontSize: 15, fontWeight: "700" },

  // Multi-select rows
  multiRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
  },
  multiRowSelected: { borderColor: Palette.pawGold, backgroundColor: "rgba(250,199,117,0.08)" },
  multiEmoji: { fontSize: 20, marginRight: 12 },
  multiLabel: { flex: 1, color: C.textSecondary, fontSize: 15 },
  multiLabelSelected: { color: C.text, fontWeight: "500" },
  check: { color: Palette.pawGold, fontSize: 18, fontWeight: "700" },

  // Time
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16, width: "100%" },
  timeCard: {
    width: "47%", backgroundColor: C.surface, borderWidth: 2, borderColor: C.border,
    borderRadius: Radius.lg, paddingVertical: 18, alignItems: "center",
  },
  timeCardSelected: { borderColor: Palette.pawGold, backgroundColor: "rgba(250,199,117,0.08)" },
  timeCardText: { color: C.textSecondary, fontSize: 16, fontWeight: "600" },
  timeCardTextSel: { color: C.text },
  timeColon: { color: C.text, fontSize: 28, fontWeight: "700", marginTop: ITEM_HEIGHT * 2 + 8 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  loadingTitle: { color: C.text, fontSize: 26, fontWeight: "700", textAlign: "center", lineHeight: 34, marginBottom: 16 },
  tagsScroll: { flexGrow: 0, marginBottom: 32 },
  tag: { backgroundColor: "rgba(250,199,117,0.15)", borderRadius: Radius.full, paddingVertical: 8, paddingHorizontal: 16, marginRight: 8 },
  tagText: { color: Palette.pawGold, fontSize: 13, fontWeight: "600" },
  progressRing: {
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 6, borderColor: C.border,
    alignItems: "center", justifyContent: "center", marginBottom: 32,
  },
  progressPercent: { color: C.text, fontSize: 42, fontWeight: "800" },
  progressSub: { color: C.textSecondary, fontSize: 12, textAlign: "center", marginTop: 4, paddingHorizontal: 16 },
  progressBarBg: { width: "80%", height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: Palette.pawGold, borderRadius: 3 },
  errorText: { color: C.error, fontSize: 14, marginTop: 20, textAlign: "center" },
  retryBtn: { backgroundColor: Palette.pawGold, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 32, marginTop: 12 },
  retryBtnText: { color: Palette.questNight, fontSize: 15, fontWeight: "700" },

  // Program cards (step 11)
  programCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    borderRadius: Radius.lg, padding: 14, marginBottom: 10, gap: 12,
  },
  programCardSelected: {
    borderColor: Palette.pawGold,
    backgroundColor: "rgba(250,199,117,0.08)",
  },
  programCardLeft: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: "rgba(250,199,117,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  programCardEmoji: { fontSize: 24 },
  programCardBody: { flex: 1, minWidth: 0 },
  programCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  programCardTitle: { color: C.textSecondary, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  programCardTitleSelected: { color: C.text },
  programCardDesc: { color: C.textMuted, fontSize: 12, lineHeight: 16 },
  recommendedBadge: {
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  recommendedBadgeText: {
    color: Palette.questNight, fontSize: 9, fontWeight: "800", letterSpacing: 0.5,
  },
  programCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  programCheckOn: { backgroundColor: Palette.pawGold, borderColor: Palette.pawGold },
  programCheckMark: { color: Palette.questNight, fontSize: 14, fontWeight: "800" },

  // Bottom
  bottomBar: { paddingHorizontal: 28, paddingBottom: Platform.OS === "ios" ? 40 : 24, paddingTop: 12 },
  nextBtn: { backgroundColor: Palette.pawGold, borderRadius: Radius.lg, paddingVertical: 18, alignItems: "center" },
  nextBtnOff: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  nextBtnText: { color: Palette.questNight, fontSize: 16, fontWeight: "700" },
  nextBtnTextOff: { color: C.textMuted },
});
