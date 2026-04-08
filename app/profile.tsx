import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
import { isPurchasesConfigured, showManageSubscriptions } from "../lib/purchases";
import {
  ALL_BREEDS,
  KNOWN_SKILLS,
  LIFESTYLE_OPTIONS,
  MONTHS,
  POPULAR_BREEDS,
  TIME_OPTIONS,
  TRAINING_GOALS,
  WheelPicker,
  calcAge,
} from "./setup";

const C = Colors.dark;

const PROGRAM_LABELS: Record<string, { title: string; emoji: string }> = {
  "separation-anxiety": { title: "Separation Anxiety", emoji: "🏠" },
  "leash-walking":      { title: "Leash Walking",      emoji: "🦮" },
  "recall-training":    { title: "Recall Training",    emoji: "📣" },
  "potty-training":     { title: "Potty Training",     emoji: "🚽" },
};

// Parse "HH:MM" or "HH:MM:SS" → [hourIdx, minuteIdx into ["00","15","30","45"]]
const MINUTE_OPTIONS = ["00", "15", "30", "45"];
function parseTime(time: string | undefined): { h: number; m: number } {
  if (!time) return { h: 19, m: 0 };
  const parts = time.split(":");
  const h = Math.max(0, Math.min(23, parseInt(parts[0] ?? "19", 10) || 0));
  const minRaw = parseInt(parts[1] ?? "0", 10) || 0;
  // snap to nearest 15
  const m = Math.round(minRaw / 15) % 4;
  return { h, m };
}

// Parse YYYY-MM-DD → { monthIdx, yearIdx into years array }
function parseBirthday(bday: string | undefined, years: string[]): { mIdx: number; yIdx: number } {
  if (!bday) return { mIdx: new Date().getMonth(), yIdx: 1 };
  const d = new Date(bday);
  if (isNaN(d.getTime())) return { mIdx: new Date().getMonth(), yIdx: 1 };
  const mIdx = d.getMonth();
  const yStr = String(d.getFullYear());
  const yIdx = Math.max(0, years.indexOf(yStr));
  return { mIdx, yIdx };
}

export default function ProfileScreen() {
  const { dog, setDog, isPro, setProForDev } = useStore();
  const [email, setEmail] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable draft state — initialized when entering edit mode
  const [draftName, setDraftName] = useState("");
  const [draftBreed, setDraftBreed] = useState("");
  const [breedSearch, setBreedSearch] = useState("");
  const [draftGender, setDraftGender] = useState<"boy" | "girl" | "">("");
  const [draftGoals, setDraftGoals] = useState<string[]>([]);
  const [draftSkills, setDraftSkills] = useState<string[]>([]);
  const [draftLifestyle, setDraftLifestyle] = useState<string[]>([]);
  const [draftDailyMinutes, setDraftDailyMinutes] = useState<number>(15);
  const [draftCoparent, setDraftCoparent] = useState<boolean>(false);
  const [draftTrackHealth, setDraftTrackHealth] = useState<boolean>(false);
  const [draftEmail, setDraftEmail] = useState("");

  // Birthday picker
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 25 }, (_, i) => String(currentYear - i)), [currentYear]);
  const [bdayOpen, setBdayOpen] = useState(false);
  const [draftMonthIdx, setDraftMonthIdx] = useState<number>(new Date().getMonth());
  const [draftYearIdx, setDraftYearIdx] = useState<number>(1);
  const [draftBirthdayUnknown, setDraftBirthdayUnknown] = useState(false);
  // Confirmed birthday for save (overrides dog.birthday)
  const [draftBirthday, setDraftBirthday] = useState<string | null>(null);
  const [draftAgeText, setDraftAgeText] = useState<string>("");

  // Time picker
  const hours24 = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const [timeOpen, setTimeOpen] = useState(false);
  const [draftHourIdx, setDraftHourIdx] = useState(19);
  const [draftMinuteIdx, setDraftMinuteIdx] = useState(0);
  const [draftPreferredTime, setDraftPreferredTime] = useState<string>("19:00");

  // Account
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? "");
    })();
  }, []);

  if (!dog) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.pawGold} />
      </View>
    );
  }

  const enterEditMode = () => {
    setDraftName(dog.name);
    setDraftBreed(dog.breed ?? "");
    setBreedSearch("");
    setDraftGender((dog.gender as any) ?? "");
    setDraftGoals(dog.training_goals ?? []);
    setDraftSkills(dog.known_skills ?? []);
    setDraftLifestyle(dog.lifestyle ?? []);
    setDraftDailyMinutes(dog.daily_minutes ?? 15);
    setDraftCoparent(dog.has_coparent ?? false);
    setDraftTrackHealth(dog.track_health ?? false);
    setDraftEmail(email);

    // Birthday
    const { mIdx, yIdx } = parseBirthday(dog.birthday, years);
    setDraftMonthIdx(mIdx);
    setDraftYearIdx(yIdx);
    setDraftBirthdayUnknown(!dog.birthday);
    setDraftBirthday(dog.birthday ?? null);
    setDraftAgeText(dog.age ?? "");

    // Time
    const { h, m } = parseTime(dog.preferred_time);
    setDraftHourIdx(h);
    setDraftMinuteIdx(m);
    setDraftPreferredTime(dog.preferred_time ?? "19:00");

    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  // ── Birthday picker handlers ──
  const openBdayPicker = () => {
    const { mIdx, yIdx } = parseBirthday(draftBirthday ?? dog.birthday, years);
    setDraftMonthIdx(mIdx);
    setDraftYearIdx(yIdx);
    setBdayOpen(true);
  };
  const confirmBday = () => {
    if (draftBirthdayUnknown) {
      setDraftBirthday(null);
      setDraftAgeText("Unknown");
    } else {
      const yr = currentYear - draftYearIdx;
      setDraftBirthday(`${yr}-${String(draftMonthIdx + 1).padStart(2, "0")}-15`);
      setDraftAgeText(calcAge(draftMonthIdx, yr));
    }
    setBdayOpen(false);
  };

  // ── Time picker handlers ──
  const openTimePicker = () => {
    const { h, m } = parseTime(draftPreferredTime);
    setDraftHourIdx(h);
    setDraftMinuteIdx(m);
    setTimeOpen(true);
  };
  const confirmTime = () => {
    setDraftPreferredTime(`${hours24[draftHourIdx]}:${MINUTE_OPTIONS[draftMinuteIdx]}`);
    setTimeOpen(false);
  };

  // ── Save ──
  const saveEdit = async () => {
    if (!draftName.trim()) {
      Alert.alert("Name required", "Please enter your dog's name.");
      return;
    }
    if (!draftBreed.trim()) {
      Alert.alert("Breed required", "Please enter a breed.");
      return;
    }
    if (draftGoals.length === 0) {
      Alert.alert("Pick at least one goal", "Select at least one training goal.");
      return;
    }
    if (draftSkills.length === 0) {
      Alert.alert("Pick at least one skill", "Select at least one known skill (or 'New to training').");
      return;
    }
    setSaving(true);
    try {
      // Update dog row
      const { data, error } = await supabase
        .from("dogs")
        .update({
          name: draftName.trim(),
          breed: draftBreed.trim(),
          gender: draftGender || null,
          birthday: draftBirthday,
          age: draftAgeText || dog.age,
          training_goals: draftGoals,
          known_skills: draftSkills,
          lifestyle: draftLifestyle,
          daily_minutes: draftDailyMinutes,
          preferred_time: draftPreferredTime,
          has_coparent: draftCoparent,
          track_health: draftTrackHealth,
        })
        .eq("id", dog.id)
        .select()
        .single();
      if (error) throw error;
      if (data) setDog(data);

      // Email change → call auth.updateUser
      const trimmedEmail = draftEmail.trim().toLowerCase();
      if (trimmedEmail && trimmedEmail !== email.toLowerCase()) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailErr) {
          Alert.alert(
            "Email update failed",
            emailErr.message + "\n\nYour other changes were saved.",
          );
        } else {
          setEmail(trimmedEmail);
          Alert.alert(
            "Check your inbox",
            "We've sent a confirmation link to your new email address. Click it to finish updating.",
          );
        }
      }

      setEditing(false);
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Sign out ──
  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          setDog(null);
          router.replace("/" as any);
        },
      },
    ]);
  };

  // ── Delete account ──
  const handleDeleteAccount = () => {
    Alert.alert(
      "Remove My Account",
      `This will permanently delete ${dog.name}'s data — all training, walks, badges, health logs and your account.\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "Final confirmation. All your data will be erased forever.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete forever",
                  style: "destructive",
                  onPress: doDeleteAccount,
                },
              ],
            );
          },
        },
      ],
    );
  };

  // ── Manage subscription ──
  const handleManageSubscription = async () => {
    // In production with real RC keys: deep-link to native subscription mgmt
    if (isPurchasesConfigured()) {
      const result = await showManageSubscriptions();
      if (!result.ok) {
        Alert.alert(
          "Couldn't open subscription settings",
          result.error ?? "Try opening your App Store or Google Play account directly.",
        );
      }
      return;
    }
    // Dev mode: route to paywall (which has the dev toggle)
    router.push("/paywall" as any);
  };

  const doDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_user_account");
      if (error) throw error;
      // Clear local session — RPC has already deleted the auth user
      await supabase.auth.signOut();
      setDog(null);
      router.replace("/" as any);
    } catch (err: any) {
      Alert.alert("Couldn't delete account", err.message ?? "Try again.");
      setDeleting(false);
    }
  };

  // Toggle helpers
  const toggleInArray = (arr: string[], setArr: (v: string[]) => void, id: string) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  // Read-only label lookups
  const goalLabels = (dog.training_goals ?? [])
    .map((id) => TRAINING_GOALS.find((g) => g.id === id))
    .filter(Boolean);
  const skillLabels = (dog.known_skills ?? [])
    .map((id) => KNOWN_SKILLS.find((s) => s.id === id))
    .filter(Boolean);
  const lifestyleLabels = (dog.lifestyle ?? [])
    .map((id) => LIFESTYLE_OPTIONS.find((l) => l.id === id))
    .filter(Boolean);
  const activeProgs = (dog.active_program_slugs ?? [])
    .map((slug) => ({ slug, ...PROGRAM_LABELS[slug] }))
    .filter((p) => p.title);

  // Breed dropdown filter
  const filteredBreeds =
    breedSearch.trim().length > 0
      ? [...POPULAR_BREEDS, ...ALL_BREEDS]
          .filter((b) => b.toLowerCase().includes(breedSearch.toLowerCase()))
          .slice(0, 8)
      : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {editing ? (
          <TouchableOpacity onPress={cancelEdit} disabled={saving}>
            <Text style={[styles.headerAction, saving && { opacity: 0.4 }]}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={enterEditMode}>
            <Text style={styles.headerAction}>Edit ✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroEmoji}>🐶</Text>
          </View>
          {editing ? (
            <TextInput
              style={styles.heroNameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Dog name"
              placeholderTextColor={C.textMuted}
              maxLength={30}
            />
          ) : (
            <Text style={styles.heroName}>{dog.name}</Text>
          )}
          <Text style={styles.heroSub}>
            Level {dog.level} · {dog.total_xp} XP · 🔥 {dog.streak_days}-day streak
          </Text>
          {isPro && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>👑 PAWLO PRO</Text>
            </View>
          )}
        </View>

        {/* ── Basics ── */}
        <Text style={styles.sectionTitle}>Basics</Text>
        <View style={styles.card}>
          {/* Breed */}
          <View style={styles.row}>
            <Text style={styles.label}>Breed</Text>
            <View style={styles.rowValue}>
              {editing ? (
                <TextInput
                  style={styles.inlineInput}
                  value={breedSearch || draftBreed}
                  onChangeText={(t) => {
                    setBreedSearch(t);
                    setDraftBreed(t);
                  }}
                  placeholder="Search or type..."
                  placeholderTextColor={C.textMuted}
                />
              ) : (
                <Text style={styles.value}>{dog.breed || "—"}</Text>
              )}
            </View>
          </View>

          {/* Breed dropdown — appears under the row when typing */}
          {editing && filteredBreeds.length > 0 && (
            <View style={styles.dropdown}>
              {filteredBreeds.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={styles.dropdownRow}
                  onPress={() => {
                    setDraftBreed(b);
                    setBreedSearch("");
                  }}
                >
                  <Text style={styles.dropdownText}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Gender */}
          <View style={styles.row}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.rowValue}>
              {editing ? (
                <View style={styles.toggleRow}>
                  {(["boy", "girl"] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.togglePill, draftGender === g && styles.togglePillOn]}
                      onPress={() => setDraftGender(g)}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          draftGender === g && styles.togglePillTextOn,
                        ]}
                      >
                        {g === "boy" ? "♂ Boy" : "♀ Girl"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.value}>
                  {dog.gender === "boy" ? "♂ Boy" : dog.gender === "girl" ? "♀ Girl" : "—"}
                </Text>
              )}
            </View>
          </View>

          {/* Age — tappable in edit mode */}
          <TouchableOpacity
            style={styles.row}
            onPress={editing ? openBdayPicker : undefined}
            activeOpacity={editing ? 0.6 : 1}
          >
            <Text style={styles.label}>Age</Text>
            <View style={styles.rowValue}>
              <Text style={[styles.value, editing && { color: Palette.pawGold }]}>
                {(editing ? draftAgeText : dog.age) || "—"}
                {editing ? " ✏️" : ""}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Training ── */}
        <Text style={styles.sectionTitle}>Training</Text>
        <View style={styles.card}>
          <View style={styles.blockRow}>
            <Text style={styles.label}>Training goals</Text>
            <View style={styles.chipWrap}>
              {(editing ? TRAINING_GOALS : goalLabels).map((g: any) => {
                const sel = editing ? draftGoals.includes(g.id) : true;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.chip,
                      sel && styles.chipOn,
                      !editing && styles.chipReadonly,
                    ]}
                    onPress={() => editing && toggleInArray(draftGoals, setDraftGoals, g.id)}
                    disabled={!editing}
                  >
                    <Text style={styles.chipEmoji}>{g.emoji}</Text>
                    <Text style={[styles.chipText, sel && styles.chipTextOn]}>{g.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {!editing && goalLabels.length === 0 && <Text style={styles.empty}>No goals set</Text>}
            </View>
          </View>

          <View style={styles.blockRow}>
            <Text style={styles.label}>Known skills</Text>
            <View style={styles.chipWrap}>
              {(editing ? KNOWN_SKILLS : skillLabels).map((s: any) => {
                const sel = editing ? draftSkills.includes(s.id) : true;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.chip,
                      sel && styles.chipOn,
                      !editing && styles.chipReadonly,
                    ]}
                    onPress={() => {
                      if (!editing) return;
                      if (s.id === "new_to_training") {
                        setDraftSkills(["new_to_training"]);
                      } else {
                        const without = draftSkills.filter((x) => x !== "new_to_training");
                        setDraftSkills(
                          without.includes(s.id)
                            ? without.filter((x) => x !== s.id)
                            : [...without, s.id],
                        );
                      }
                    }}
                    disabled={!editing}
                  >
                    <Text style={styles.chipEmoji}>{s.emoji}</Text>
                    <Text style={[styles.chipText, sel && styles.chipTextOn]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {!editing && skillLabels.length === 0 && <Text style={styles.empty}>No skills logged</Text>}
            </View>
          </View>

          {/* Daily minutes */}
          <View style={styles.row}>
            <Text style={styles.label}>Daily training time</Text>
            <View style={styles.rowValue}>
              {editing ? (
                <View style={styles.toggleRow}>
                  {TIME_OPTIONS.map((o) => (
                    <TouchableOpacity
                      key={o.value}
                      style={[
                        styles.togglePill,
                        draftDailyMinutes === o.value && styles.togglePillOn,
                      ]}
                      onPress={() => setDraftDailyMinutes(o.value)}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          draftDailyMinutes === o.value && styles.togglePillTextOn,
                        ]}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.value}>{dog.daily_minutes ?? "—"} min</Text>
              )}
            </View>
          </View>

          {/* Reminder time — tappable in edit mode */}
          <TouchableOpacity
            style={styles.row}
            onPress={editing ? openTimePicker : undefined}
            activeOpacity={editing ? 0.6 : 1}
          >
            <Text style={styles.label}>Reminder time</Text>
            <View style={styles.rowValue}>
              <Text style={[styles.value, editing && { color: Palette.pawGold }]}>
                {(editing ? draftPreferredTime : dog.preferred_time) || "—"}
                {editing ? " ✏️" : ""}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Active Programs ── */}
        <Text style={styles.sectionTitle}>Active Programs</Text>
        <View style={styles.card}>
          {activeProgs.length === 0 ? (
            <Text style={styles.empty}>No programs selected</Text>
          ) : (
            activeProgs.map((p) => (
              <View key={p.slug} style={styles.programRow}>
                <Text style={styles.programEmoji}>{p.emoji}</Text>
                <Text style={styles.programTitle}>{p.title}</Text>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.manageProgramsBtn} onPress={() => router.back()}>
            <Text style={styles.manageProgramsText}>Manage from dashboard →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Lifestyle & Care ── */}
        <Text style={styles.sectionTitle}>Lifestyle & Care</Text>
        <View style={styles.card}>
          <View style={styles.blockRow}>
            <Text style={styles.label}>Lifestyle</Text>
            <View style={styles.chipWrap}>
              {(editing ? LIFESTYLE_OPTIONS : lifestyleLabels).map((l: any) => {
                const sel = editing ? draftLifestyle.includes(l.id) : true;
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[
                      styles.chip,
                      sel && styles.chipOn,
                      !editing && styles.chipReadonly,
                    ]}
                    onPress={() => editing && toggleInArray(draftLifestyle, setDraftLifestyle, l.id)}
                    disabled={!editing}
                  >
                    <Text style={styles.chipEmoji}>{l.emoji}</Text>
                    <Text style={[styles.chipText, sel && styles.chipTextOn]}>{l.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {!editing && lifestyleLabels.length === 0 && (
                <Text style={styles.empty}>No lifestyle tags</Text>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Co-parent</Text>
            <View style={styles.rowValue}>
              {editing ? (
                <View style={styles.toggleRow}>
                  {[
                    { val: false, lbl: "Just me" },
                    { val: true, lbl: "Yes" },
                  ].map((o) => (
                    <TouchableOpacity
                      key={String(o.val)}
                      style={[styles.togglePill, draftCoparent === o.val && styles.togglePillOn]}
                      onPress={() => setDraftCoparent(o.val)}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          draftCoparent === o.val && styles.togglePillTextOn,
                        ]}
                      >
                        {o.lbl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.value}>{dog.has_coparent ? "Yes" : "Just me"}</Text>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Track health & walks</Text>
            <View style={styles.rowValue}>
              {editing ? (
                <View style={styles.toggleRow}>
                  {[
                    { val: false, lbl: "Off" },
                    { val: true, lbl: "On" },
                  ].map((o) => (
                    <TouchableOpacity
                      key={String(o.val)}
                      style={[styles.togglePill, draftTrackHealth === o.val && styles.togglePillOn]}
                      onPress={() => setDraftTrackHealth(o.val)}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          draftTrackHealth === o.val && styles.togglePillTextOn,
                        ]}
                      >
                        {o.lbl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.value}>{dog.track_health ? "On" : "Off"}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Pawlo Pro section ── */}
        {!editing && (
          <>
            <Text style={styles.sectionTitle}>Pawlo Pro</Text>
            {isPro ? (
              <View style={styles.proActiveCard}>
                <View style={styles.proActiveHeader}>
                  <Text style={styles.proActiveEmoji}>👑</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proActiveTitle}>You're a Pawlo Pro</Text>
                    <Text style={styles.proActiveSub}>
                      All programs unlocked · 12 tricks · unlimited Pawlo
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={handleManageSubscription}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manageBtnText}>Manage Subscription →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.proUpsellCard}
                onPress={() => router.push("/paywall" as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.proUpsellEmoji}>👑</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.proUpsellTitle}>Unlock everything</Text>
                  <Text style={styles.proUpsellSub}>
                    All 4 programs · 12 tricks · unlimited Pawlo
                  </Text>
                </View>
                <Text style={styles.proUpsellArrow}>→</Text>
              </TouchableOpacity>
            )}

            {/* Dev-only quick toggle so we can test gating without leaving profile */}
            {__DEV__ && (
              <TouchableOpacity
                style={styles.devProToggle}
                onPress={() => setProForDev(!isPro)}
              >
                <Text style={styles.devProToggleText}>
                  DEV: Toggle Pro {isPro ? "OFF" : "ON"}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Account ── */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.rowValue}>
              {editing ? (
                <TextInput
                  style={[styles.inlineInput, { minWidth: 200 }]}
                  value={draftEmail}
                  onChangeText={setDraftEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : (
                <Text style={styles.value} numberOfLines={1}>{email || "—"}</Text>
              )}
            </View>
          </View>

          {!editing && (
            <>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                <Text style={styles.deleteBtnText}>
                  {deleting ? "Deleting..." : "Remove My Account"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: editing ? 120 : 60 }} />
      </ScrollView>

      {/* ── Save Bar (edit mode) ── */}
      {editing && (
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveEdit}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Birthday Picker Modal ── */}
      <Modal visible={bdayOpen} transparent animationType="slide" onRequestClose={() => setBdayOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>When is {dog.name}'s birthday?</Text>

            {!draftBirthdayUnknown && (
              <View style={styles.wheelRow}>
                <WheelPicker
                  data={MONTHS}
                  selectedIndex={draftMonthIdx}
                  onSelect={setDraftMonthIdx}
                  width={100}
                />
                <WheelPicker
                  data={years}
                  selectedIndex={draftYearIdx}
                  onSelect={setDraftYearIdx}
                  width={110}
                />
              </View>
            )}

            <TouchableOpacity
              style={styles.skipLink}
              onPress={() => setDraftBirthdayUnknown(!draftBirthdayUnknown)}
            >
              <Text style={styles.skipLinkText}>
                {draftBirthdayUnknown ? "I know the birthday" : "I don't know"}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setBdayOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={confirmBday}>
                <Text style={styles.modalSaveText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Time Picker Modal ── */}
      <Modal visible={timeOpen} transparent animationType="slide" onRequestClose={() => setTimeOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Reminder time</Text>
            <Text style={styles.modalSub}>We'll remind you to train at this time daily.</Text>

            <View style={styles.wheelRow}>
              <WheelPicker
                data={hours24}
                selectedIndex={draftHourIdx}
                onSelect={setDraftHourIdx}
                width={90}
              />
              <Text style={styles.colon}>:</Text>
              <WheelPicker
                data={MINUTE_OPTIONS}
                selectedIndex={draftMinuteIdx}
                onSelect={setDraftMinuteIdx}
                width={90}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setTimeOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={confirmTime}>
                <Text style={styles.modalSaveText}>Done</Text>
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
    flex: 1, backgroundColor: C.background,
    alignItems: "center", justifyContent: "center",
  },
  container: { flex: 1, backgroundColor: C.background },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.xl, paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  backText: { color: C.text, fontSize: 18, fontWeight: "600" },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: "700" },
  headerAction: { color: Palette.pawGold, fontSize: 14, fontWeight: "700" },

  // Hero
  hero: { alignItems: "center", paddingTop: 24, paddingBottom: 16 },
  heroAvatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Palette.pawGold,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  heroEmoji: { fontSize: 44 },
  heroName: { color: C.text, fontSize: 24, fontWeight: "700", marginBottom: 4 },
  heroNameInput: {
    color: C.text, fontSize: 22, fontWeight: "700",
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: Palette.pawGold,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 8,
    textAlign: "center", marginBottom: 6, minWidth: 200,
  },
  heroSub: { color: C.textSecondary, fontSize: 13 },
  proBadge: {
    marginTop: 12,
    backgroundColor: "rgba(250,199,117,0.18)",
    borderWidth: 1,
    borderColor: Palette.pawGold,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  proBadgeText: {
    color: Palette.pawGold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  proUpsellCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: "rgba(250,199,117,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.3)",
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  proUpsellEmoji: { fontSize: 32 },
  proUpsellTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  proUpsellSub: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  proUpsellArrow: { color: Palette.pawGold, fontSize: 22, fontWeight: "800" },

  // Pro active state
  proActiveCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: "rgba(250,199,117,0.1)",
    borderWidth: 1,
    borderColor: Palette.pawGold,
    borderRadius: Radius.lg,
    padding: 16,
  },
  proActiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  proActiveEmoji: { fontSize: 32 },
  proActiveTitle: { color: Palette.pawGold, fontSize: 16, fontWeight: "800" },
  proActiveSub: { color: C.textSecondary, fontSize: 12, marginTop: 2 },
  manageBtn: {
    backgroundColor: "rgba(250,199,117,0.18)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.4)",
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  manageBtnText: { color: Palette.pawGold, fontSize: 14, fontWeight: "700" },

  // Dev-only Pro toggle
  devProToggle: {
    marginHorizontal: Spacing.xl,
    marginTop: 8,
    backgroundColor: "rgba(231,111,81,0.1)",
    borderWidth: 1,
    borderColor: "rgba(231,111,81,0.4)",
    borderStyle: "dashed",
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  devProToggleText: { color: "#E76F51", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },

  // Sections
  sectionTitle: {
    color: C.textSecondary, fontSize: 12, fontWeight: "700",
    letterSpacing: 1, paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg, marginBottom: 8, textTransform: "uppercase",
  },
  card: {
    marginHorizontal: Spacing.xl,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 14,
  },

  // Row
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
    minHeight: 44,
  },
  rowValue: { flex: 1, alignItems: "flex-end", marginLeft: 12 },
  label: { color: C.textSecondary, fontSize: 13, fontWeight: "500" },
  value: { color: C.text, fontSize: 14, fontWeight: "600", textAlign: "right" },
  empty: { color: C.textMuted, fontSize: 13, fontStyle: "italic" },

  blockRow: {
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },

  // Inline editor
  inlineInput: {
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6,
    color: C.text, fontSize: 14, minWidth: 140, textAlign: "right",
  },

  // Breed dropdown
  dropdown: {
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.md, marginTop: -2, marginBottom: 8, overflow: "hidden",
  },
  dropdownRow: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dropdownText: { color: C.text, fontSize: 13 },

  // Toggle pills
  toggleRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  togglePill: {
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  togglePillOn: { backgroundColor: Palette.pawGold, borderColor: Palette.pawGold },
  togglePillText: { color: C.textSecondary, fontSize: 12, fontWeight: "600" },
  togglePillTextOn: { color: Palette.questNight, fontWeight: "700" },

  // Chips
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6,
  },
  chipOn: { backgroundColor: "rgba(250,199,117,0.15)", borderColor: Palette.pawGold },
  chipReadonly: { backgroundColor: "rgba(250,199,117,0.12)", borderColor: "rgba(250,199,117,0.3)" },
  chipEmoji: { fontSize: 13 },
  chipText: { color: C.textSecondary, fontSize: 12, fontWeight: "500" },
  chipTextOn: { color: C.text, fontWeight: "600" },

  // Programs
  programRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  programEmoji: { fontSize: 22 },
  programTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  manageProgramsBtn: { paddingTop: 12, alignItems: "center" },
  manageProgramsText: { color: Palette.pawGold, fontSize: 13, fontWeight: "600" },

  // Account buttons
  deleteBtn: {
    marginTop: 12, backgroundColor: "rgba(231,111,81,0.18)",
    borderWidth: 1, borderColor: "#E76F51",
    borderRadius: Radius.lg, paddingVertical: 12, alignItems: "center",
  },
  deleteBtnText: { color: "#E76F51", fontSize: 14, fontWeight: "700" },
  signOutBtn: {
    marginTop: 8, backgroundColor: C.background,
    borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, paddingVertical: 12, alignItems: "center",
  },
  signOutText: { color: C.textSecondary, fontSize: 14, fontWeight: "700" },

  // Save bar
  saveBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: C.background, borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: Spacing.xl,
    paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 32 : 16,
  },
  saveBtn: {
    backgroundColor: Palette.pawGold, borderRadius: Radius.lg,
    paddingVertical: 16, alignItems: "center",
  },
  saveBtnText: { color: Palette.questNight, fontSize: 15, fontWeight: "700" },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderTopWidth: 1, borderColor: C.border,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: { color: C.text, fontSize: 20, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  modalSub: { color: C.textSecondary, fontSize: 13, marginBottom: 12, textAlign: "center" },
  wheelRow: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, marginVertical: 16,
  },
  colon: { color: C.text, fontSize: 28, fontWeight: "700" },
  skipLink: { alignSelf: "center", marginVertical: 4, paddingVertical: 6 },
  skipLinkText: { color: C.textSecondary, fontSize: 13, textDecorationLine: "underline" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalCancel: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center",
  },
  modalCancelText: { color: C.textSecondary, fontSize: 15, fontWeight: "600" },
  modalSave: {
    flex: 2, backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center",
  },
  modalSaveText: { color: Palette.questNight, fontSize: 15, fontWeight: "700" },
});
