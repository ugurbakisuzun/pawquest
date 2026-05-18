import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
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
import { scheduleDateReminder, scheduleRecurringReminder } from "../lib/reminders";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.light;
const SCREEN_W = Dimensions.get("window").width;

type Tab = "weight" | "vaccinations" | "medications" | "grooming" | "vet";

interface WeightLog {
  id: string;
  weight_kg: number;
  note: string | null;
  logged_at: string;
}

interface Vaccination {
  id: string;
  name: string;
  date_given: string;
  next_due: string | null;
  vet_name: string | null;
  note: string | null;
  recurrence_weeks: number | null;
}

interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: string;
  end_date: string | null;
  note: string | null;
  active: boolean;
  recurrence_weeks: number | null;
}

interface GroomingLog {
  id: string;
  grooming_type: string;
  date_done: string;
  next_due: string | null;
  recurrence_weeks: number | null;
  note: string | null;
}

interface VetCheck {
  id: string;
  reason: string;
  date_done: string;
  vet_name: string | null;
  next_due: string | null;
  recurrence_weeks: number | null;
  note: string | null;
}

const RECURRENCE_OPTIONS = [
  { label: "None", value: null },
  { label: "Weekly", value: 1 },
  { label: "Every 2 weeks", value: 2 },
  { label: "Every 4 weeks", value: 4 },
  { label: "Every 5 weeks", value: 5 },
  { label: "Every 6 weeks", value: 6 },
  { label: "Monthly (~4w)", value: 4 },
  { label: "Every 3 months", value: 13 },
  { label: "Every 6 months", value: 26 },
  { label: "Yearly", value: 52 },
];

const GROOMING_TYPES = ["Bath", "Nail Trim", "Haircut", "Brush", "Ear Cleaning", "Teeth Cleaning", "Other"];
const VET_REASONS = ["Annual Checkup", "Dental", "Blood Work", "Vaccination Visit", "Emergency", "Other"];

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HealthScreen() {
  const { dog } = useStore();
  const params = useLocalSearchParams();
  const allTabs: Tab[] = ["weight", "vaccinations", "medications", "grooming", "vet"];
  const initialTab = allTabs.includes(params.tab as Tab) ? (params.tab as Tab) : "weight";
  const [tab, setTab] = useState<Tab>(initialTab);

  // Weight
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newWeightNote, setNewWeightNote] = useState("");

  // Vaccinations
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [showAddVax, setShowAddVax] = useState(false);
  const [vaxName, setVaxName] = useState("");
  const [vaxDate, setVaxDate] = useState(todayStr());
  const [vaxNextDue, setVaxNextDue] = useState("");
  const [vaxVet, setVaxVet] = useState("");
  const [vaxRecurrence, setVaxRecurrence] = useState<number | null>(null);

  // Medications
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showAddMed, setShowAddMed] = useState(false);
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("");
  const [medStartDate, setMedStartDate] = useState(todayStr());
  const [medRecurrence, setMedRecurrence] = useState<number | null>(null);

  // Grooming
  const [groomings, setGroomings] = useState<GroomingLog[]>([]);
  const [showAddGroom, setShowAddGroom] = useState(false);
  const [groomType, setGroomType] = useState("Bath");
  const [groomDate, setGroomDate] = useState(todayStr());
  const [groomNextDue, setGroomNextDue] = useState("");
  const [groomRecurrence, setGroomRecurrence] = useState<number | null>(null);
  const [groomNote, setGroomNote] = useState("");

  // Vet
  const [vetChecks, setVetChecks] = useState<VetCheck[]>([]);
  const [showAddVet, setShowAddVet] = useState(false);
  const [vetReason, setVetReason] = useState("Annual Checkup");
  const [vetDate, setVetDate] = useState(todayStr());
  const [vetName, setVetName] = useState("");
  const [vetNextDue, setVetNextDue] = useState("");
  const [vetRecurrence, setVetRecurrence] = useState<number | null>(null);
  const [vetNote, setVetNote] = useState("");

  // Date picker state
  const [datePickerField, setDatePickerField] = useState<string | null>(null);

  const parseDateSafe = (str: string): Date => {
    const d = new Date(str + "T12:00:00");
    return isNaN(d.getTime()) ? new Date() : d;
  };
  const formatDateISO = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const handleDateChange = (_: any, selectedDate?: Date) => {
    const field = datePickerField;
    setDatePickerField(null);
    if (!selectedDate || !field) return;
    const iso = formatDateISO(selectedDate);
    if (field === "vaxDate") setVaxDate(iso);
    else if (field === "vaxNextDue") setVaxNextDue(iso);
    else if (field === "medStartDate") setMedStartDate(iso);
    else if (field === "groomDate") setGroomDate(iso);
    else if (field === "groomNextDue") setGroomNextDue(iso);
    else if (field === "vetDate") setVetDate(iso);
    else if (field === "vetNextDue") setVetNextDue(iso);
  };

  useEffect(() => {
    if (dog) {
      loadWeights();
      loadVaccinations();
      loadMedications();
      loadGroomings();
      loadVetChecks();
    }
  }, [dog?.id]);

  // ── Loaders ──

  const loadWeights = async () => {
    const { data } = await supabase.from("weight_logs").select("*").eq("dog_id", dog!.id).order("logged_at", { ascending: false });
    setWeights(data ?? []);
  };
  const loadVaccinations = async () => {
    const { data } = await supabase.from("vaccinations").select("*").eq("dog_id", dog!.id).order("date_given", { ascending: false });
    setVaccinations(data ?? []);
  };
  const loadMedications = async () => {
    const { data } = await supabase.from("medications").select("*").eq("dog_id", dog!.id).order("created_at", { ascending: false });
    setMedications(data ?? []);
  };
  const loadGroomings = async () => {
    const { data } = await supabase.from("grooming_logs").select("*").eq("dog_id", dog!.id).order("date_done", { ascending: false });
    setGroomings(data ?? []);
  };
  const loadVetChecks = async () => {
    const { data } = await supabase.from("vet_checks").select("*").eq("dog_id", dog!.id).order("date_done", { ascending: false });
    setVetChecks(data ?? []);
  };

  // ── Add handlers ──

  const addWeight = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) { Alert.alert("Invalid weight"); return; }
    await supabase.from("weight_logs").insert({ dog_id: dog!.id, weight_kg: w, note: newWeightNote || null, logged_at: todayStr() });
    setNewWeight(""); setNewWeightNote(""); setShowAddWeight(false); loadWeights();
  };

  const addVaccination = async () => {
    if (!vaxName.trim()) { Alert.alert("Enter vaccination name"); return; }
    const { data } = await supabase.from("vaccinations").insert({
      dog_id: dog!.id, name: vaxName.trim(), date_given: vaxDate,
      next_due: vaxNextDue || null, vet_name: vaxVet || null,
      recurrence_weeks: vaxRecurrence,
    }).select().single();
    if (data && vaxNextDue && vaxRecurrence) {
      await scheduleRecurringReminder(dog!.id, dog!.name, "vaccination", data.id, vaxName, vaxNextDue, vaxRecurrence);
    } else if (data && vaxNextDue) {
      await scheduleDateReminder(dog!.id, dog!.name, "vaccination", data.id, vaxName, vaxNextDue);
    }
    setVaxName(""); setVaxNextDue(""); setVaxVet(""); setVaxRecurrence(null);
    setShowAddVax(false); loadVaccinations();
  };

  const addMedication = async () => {
    if (!medName.trim()) { Alert.alert("Enter medication name"); return; }
    await supabase.from("medications").insert({
      dog_id: dog!.id, name: medName.trim(), dosage: medDosage || null,
      frequency: medFrequency || null, start_date: medStartDate, active: true,
      recurrence_weeks: medRecurrence,
    });
    setMedName(""); setMedDosage(""); setMedFrequency(""); setMedRecurrence(null);
    setShowAddMed(false); loadMedications();
  };

  const addGrooming = async () => {
    const { data } = await supabase.from("grooming_logs").insert({
      dog_id: dog!.id, grooming_type: groomType, date_done: groomDate,
      next_due: groomNextDue || null, recurrence_weeks: groomRecurrence,
      note: groomNote || null,
    }).select().single();
    if (data && groomNextDue && groomRecurrence) {
      await scheduleRecurringReminder(dog!.id, dog!.name, "grooming", data.id, groomType, groomNextDue, groomRecurrence);
    } else if (data && groomNextDue) {
      await scheduleDateReminder(dog!.id, dog!.name, "grooming", data.id, groomType, groomNextDue);
    }
    setGroomType("Bath"); setGroomNextDue(""); setGroomRecurrence(null); setGroomNote("");
    setShowAddGroom(false); loadGroomings();
  };

  const addVetCheck = async () => {
    const { data } = await supabase.from("vet_checks").insert({
      dog_id: dog!.id, reason: vetReason, date_done: vetDate,
      vet_name: vetName || null, next_due: vetNextDue || null,
      recurrence_weeks: vetRecurrence, note: vetNote || null,
    }).select().single();
    if (data && vetNextDue && vetRecurrence) {
      await scheduleRecurringReminder(dog!.id, dog!.name, "vet", data.id, vetReason, vetNextDue, vetRecurrence);
    } else if (data && vetNextDue) {
      await scheduleDateReminder(dog!.id, dog!.name, "vet", data.id, vetReason, vetNextDue);
    }
    setVetReason("Annual Checkup"); setVetName(""); setVetNextDue(""); setVetRecurrence(null); setVetNote("");
    setShowAddVet(false); loadVetChecks();
  };

  // ── Delete handlers ──

  const deleteWeight = (id: string) => confirmDelete("weight entry", () => supabase.from("weight_logs").delete().eq("id", id).then(loadWeights));
  const deleteVaccination = (id: string) => confirmDelete("vaccination", () => supabase.from("vaccinations").delete().eq("id", id).then(loadVaccinations));
  const deleteGrooming = (id: string) => confirmDelete("grooming entry", () => supabase.from("grooming_logs").delete().eq("id", id).then(loadGroomings));
  const deleteVetCheck = (id: string) => confirmDelete("vet check", () => supabase.from("vet_checks").delete().eq("id", id).then(loadVetChecks));

  const confirmDelete = (label: string, onDelete: () => void) => {
    Alert.alert("Delete?", `Remove this ${label}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };

  const toggleMedication = async (med: Medication) => {
    await supabase.from("medications").update({ active: !med.active, end_date: !med.active ? null : todayStr() }).eq("id", med.id);
    loadMedications();
  };
  const deleteMedication = (id: string) => confirmDelete("medication", () => supabase.from("medications").delete().eq("id", id).then(loadMedications));

  // ── Weight chart ──
  const chartWeights = [...weights].reverse().slice(-10);
  const maxW = Math.max(...chartWeights.map((w) => w.weight_kg), 1);
  const minW = Math.min(...chartWeights.map((w) => w.weight_kg), 0);
  const range = maxW - minW || 1;

  const upcomingVax = vaccinations.filter((v) => v.next_due && new Date(v.next_due) >= new Date(todayStr()));
  const upcomingGroom = groomings.filter((g) => g.next_due && new Date(g.next_due) >= new Date(todayStr()));
  const upcomingVet = vetChecks.filter((v) => v.next_due && new Date(v.next_due) >= new Date(todayStr()));

  // ── Reusable components ──

  const RecurrencePicker = ({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) => (
    <View style={styles.recurrenceWrap}>
      <Text style={styles.recurrenceLabel}>Recurring reminder</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recurrenceRow}>
        {RECURRENCE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={[styles.recurrenceChip, value === opt.value && styles.recurrenceChipActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.recurrenceChipText, value === opt.value && styles.recurrenceChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const TypePicker = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typePickerRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.typePickerChip, value === opt && styles.typePickerChipActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.typePickerText, value === opt && styles.typePickerTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const DateField = ({ value, placeholder, field }: { value: string; placeholder: string; field: string }) => (
    <>
      <TouchableOpacity style={styles.dateField} onPress={() => setDatePickerField(field)}>
        <Text style={value ? styles.dateFieldText : styles.dateFieldPlaceholder}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Text style={styles.dateFieldIcon}>📅</Text>
      </TouchableOpacity>
      {datePickerField === field && (
        <DateTimePicker value={parseDateSafe(value || todayStr())} mode="date" display="default" onChange={handleDateChange} />
      )}
    </>
  );

  const UpcomingSection = ({ items, emoji }: { items: { id: string; name: string; next_due: string }[]; emoji: string }) => (
    items.length > 0 ? (
      <>
        <Text style={styles.listTitle}>Upcoming</Text>
        {items.map((v) => (
          <View key={v.id + "_up"} style={[styles.listRow, { borderColor: "rgba(250,199,117,0.25)" }]}>
            <View style={[styles.listIcon, { backgroundColor: "rgba(250,199,117,0.1)" }]}>
              <Text style={{ fontSize: 16 }}>⏰</Text>
            </View>
            <View style={styles.listInfo}>
              <Text style={styles.listPrimary}>{v.name}</Text>
              <Text style={[styles.listSecondary, { color: Palette.pawGold }]}>Due: {formatDate(v.next_due)}</Text>
            </View>
          </View>
        ))}
      </>
    ) : null
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{dog?.name}'s Health</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs — horizontally scrollable */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {([
          { id: "weight" as Tab, label: "Weight", emoji: "⚖️" },
          { id: "vaccinations" as Tab, label: "Vaccines", emoji: "💉" },
          { id: "medications" as Tab, label: "Meds", emoji: "💊" },
          { id: "grooming" as Tab, label: "Grooming", emoji: "✂️" },
          { id: "vet" as Tab, label: "Vet", emoji: "🏥" },
        ]).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={styles.tabEmoji}>{t.emoji}</Text>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* ══════ WEIGHT TAB ══════ */}
        {tab === "weight" && (
          <View style={styles.tabContent}>
            {weights.length > 0 && (
              <View style={styles.currentCard}>
                <Text style={styles.currentLabel}>Current Weight</Text>
                <Text style={styles.currentValue}>{weights[0].weight_kg} kg</Text>
                <Text style={styles.currentSub}>Last updated {formatDate(weights[0].logged_at)}</Text>
                {weights.length >= 2 && (
                  <View style={styles.changeBadge}>
                    {(() => {
                      const diff = weights[0].weight_kg - weights[1].weight_kg;
                      const sign = diff >= 0 ? "+" : "";
                      return <Text style={[styles.changeText, { color: diff === 0 ? C.textSecondary : diff > 0 ? Palette.alertCoral : Palette.streakGreen }]}>{sign}{diff.toFixed(2)} kg since last</Text>;
                    })()}
                  </View>
                )}
              </View>
            )}
            {chartWeights.length >= 2 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Weight History</Text>
                <View style={styles.chart}>
                  {chartWeights.map((w) => {
                    const height = Math.max(((w.weight_kg - minW) / range) * 100, 8);
                    return (
                      <View key={w.id} style={styles.chartBar}>
                        <Text style={styles.chartBarLabel}>{w.weight_kg}</Text>
                        <View style={[styles.chartBarFill, { height: `${height}%` }]} />
                        <Text style={styles.chartBarDate}>{new Date(w.logged_at + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
            {!showAddWeight ? (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddWeight(true)}>
                <Text style={styles.addBtnText}>+ Log Weight</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Log Weight</Text>
                <TextInput style={styles.input} placeholder="Weight in kg (e.g. 12.5)" placeholderTextColor={C.textMuted} value={newWeight} onChangeText={setNewWeight} keyboardType="decimal-pad" autoFocus />
                <TextInput style={styles.input} placeholder="Note (optional)" placeholderTextColor={C.textMuted} value={newWeightNote} onChangeText={setNewWeightNote} />
                <View style={styles.formBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddWeight(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={addWeight}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            )}
            {weights.length > 0 && <Text style={styles.listTitle}>All Entries</Text>}
            {weights.map((w) => (
              <TouchableOpacity key={w.id} style={styles.listRow} onLongPress={() => deleteWeight(w.id)}>
                <View style={styles.listIcon}><Text style={{ fontSize: 16 }}>⚖️</Text></View>
                <View style={styles.listInfo}>
                  <Text style={styles.listPrimary}>{w.weight_kg} kg</Text>
                  <Text style={styles.listSecondary}>{formatDate(w.logged_at)}{w.note ? ` · ${w.note}` : ""}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══════ VACCINATIONS TAB ══════ */}
        {tab === "vaccinations" && (
          <View style={styles.tabContent}>
            <UpcomingSection items={upcomingVax.map((v) => ({ id: v.id, name: v.name, next_due: v.next_due! }))} emoji="💉" />
            {!showAddVax ? (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddVax(true)}><Text style={styles.addBtnText}>+ Add Vaccination</Text></TouchableOpacity>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Add Vaccination</Text>
                <TextInput style={styles.input} placeholder="Vaccine name (e.g. Rabies)" placeholderTextColor={C.textMuted} value={vaxName} onChangeText={setVaxName} autoFocus />
                <DateField value={vaxDate} placeholder="Date given" field="vaxDate" />
                <DateField value={vaxNextDue} placeholder="Next due date (optional)" field="vaxNextDue" />
                <TextInput style={styles.input} placeholder="Vet name (optional)" placeholderTextColor={C.textMuted} value={vaxVet} onChangeText={setVaxVet} />
                <RecurrencePicker value={vaxRecurrence} onChange={setVaxRecurrence} />
                <View style={styles.formBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddVax(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={addVaccination}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            )}
            {vaccinations.length > 0 && <Text style={styles.listTitle}>All Vaccinations</Text>}
            {vaccinations.map((v) => (
              <TouchableOpacity key={v.id} style={styles.listRow} onLongPress={() => deleteVaccination(v.id)}>
                <View style={styles.listIcon}><Text style={{ fontSize: 16 }}>💉</Text></View>
                <View style={styles.listInfo}>
                  <Text style={styles.listPrimary}>{v.name}</Text>
                  <Text style={styles.listSecondary}>
                    Given: {formatDate(v.date_given)}{v.next_due ? ` · Next: ${formatDate(v.next_due)}` : ""}{v.vet_name ? ` · ${v.vet_name}` : ""}
                    {v.recurrence_weeks ? ` · Every ${v.recurrence_weeks}w` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══════ MEDICATIONS TAB ══════ */}
        {tab === "medications" && (
          <View style={styles.tabContent}>
            {!showAddMed ? (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddMed(true)}><Text style={styles.addBtnText}>+ Add Medication</Text></TouchableOpacity>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Add Medication</Text>
                <TextInput style={styles.input} placeholder="Medication name" placeholderTextColor={C.textMuted} value={medName} onChangeText={setMedName} autoFocus />
                <TextInput style={styles.input} placeholder="Dosage (e.g. 10mg)" placeholderTextColor={C.textMuted} value={medDosage} onChangeText={setMedDosage} />
                <TextInput style={styles.input} placeholder="Frequency (e.g. Twice daily)" placeholderTextColor={C.textMuted} value={medFrequency} onChangeText={setMedFrequency} />
                <DateField value={medStartDate} placeholder="Start date" field="medStartDate" />
                <RecurrencePicker value={medRecurrence} onChange={setMedRecurrence} />
                <View style={styles.formBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddMed(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={addMedication}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            )}
            {medications.filter((m) => m.active).length > 0 && <Text style={styles.listTitle}>Active</Text>}
            {medications.filter((m) => m.active).map((m) => (
              <TouchableOpacity key={m.id} style={styles.listRow} onPress={() => toggleMedication(m)} onLongPress={() => deleteMedication(m.id)}>
                <View style={[styles.listIcon, { backgroundColor: "rgba(29,158,117,0.1)" }]}><Text style={{ fontSize: 16 }}>💊</Text></View>
                <View style={styles.listInfo}>
                  <Text style={styles.listPrimary}>{m.name}</Text>
                  <Text style={styles.listSecondary}>{m.dosage ? `${m.dosage} · ` : ""}{m.frequency ?? "As needed"} · Since {formatDate(m.start_date)}</Text>
                </View>
                <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>
              </TouchableOpacity>
            ))}
            {medications.filter((m) => !m.active).length > 0 && <Text style={styles.listTitle}>Completed</Text>}
            {medications.filter((m) => !m.active).map((m) => (
              <TouchableOpacity key={m.id} style={[styles.listRow, { opacity: 0.5 }]} onPress={() => toggleMedication(m)} onLongPress={() => deleteMedication(m.id)}>
                <View style={styles.listIcon}><Text style={{ fontSize: 16 }}>💊</Text></View>
                <View style={styles.listInfo}>
                  <Text style={styles.listPrimary}>{m.name}</Text>
                  <Text style={styles.listSecondary}>{m.dosage ? `${m.dosage} · ` : ""}{formatDate(m.start_date)}{m.end_date ? ` → ${formatDate(m.end_date)}` : ""}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {medications.length > 0 && <Text style={styles.hintText}>Tap to toggle active/completed · Long press to delete</Text>}
          </View>
        )}

        {/* ══════ GROOMING TAB ══════ */}
        {tab === "grooming" && (
          <View style={styles.tabContent}>
            <UpcomingSection items={upcomingGroom.map((g) => ({ id: g.id, name: g.grooming_type, next_due: g.next_due! }))} emoji="✂️" />
            {!showAddGroom ? (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddGroom(true)}><Text style={styles.addBtnText}>+ Log Grooming</Text></TouchableOpacity>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Log Grooming</Text>
                <Text style={styles.fieldLabel}>Type</Text>
                <TypePicker options={GROOMING_TYPES} value={groomType} onChange={setGroomType} />
                <DateField value={groomDate} placeholder="Date done" field="groomDate" />
                <DateField value={groomNextDue} placeholder="Next due (optional)" field="groomNextDue" />
                <RecurrencePicker value={groomRecurrence} onChange={setGroomRecurrence} />
                <TextInput style={styles.input} placeholder="Note (optional)" placeholderTextColor={C.textMuted} value={groomNote} onChangeText={setGroomNote} />
                <View style={styles.formBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddGroom(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={addGrooming}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            )}
            {groomings.length > 0 && <Text style={styles.listTitle}>All Grooming</Text>}
            {groomings.map((g) => (
              <TouchableOpacity key={g.id} style={styles.listRow} onLongPress={() => deleteGrooming(g.id)}>
                <View style={[styles.listIcon, { backgroundColor: "rgba(127,119,221,0.1)" }]}><Text style={{ fontSize: 16 }}>✂️</Text></View>
                <View style={styles.listInfo}>
                  <Text style={styles.listPrimary}>{g.grooming_type}</Text>
                  <Text style={styles.listSecondary}>
                    {formatDate(g.date_done)}{g.next_due ? ` · Next: ${formatDate(g.next_due)}` : ""}
                    {g.recurrence_weeks ? ` · Every ${g.recurrence_weeks}w` : ""}
                    {g.note ? ` · ${g.note}` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══════ VET TAB ══════ */}
        {tab === "vet" && (
          <View style={styles.tabContent}>
            <UpcomingSection items={upcomingVet.map((v) => ({ id: v.id, name: v.reason, next_due: v.next_due! }))} emoji="🏥" />
            {!showAddVet ? (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddVet(true)}><Text style={styles.addBtnText}>+ Log Vet Visit</Text></TouchableOpacity>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Log Vet Visit</Text>
                <Text style={styles.fieldLabel}>Reason</Text>
                <TypePicker options={VET_REASONS} value={vetReason} onChange={setVetReason} />
                <DateField value={vetDate} placeholder="Date of visit" field="vetDate" />
                <TextInput style={styles.input} placeholder="Vet name (optional)" placeholderTextColor={C.textMuted} value={vetName} onChangeText={setVetName} />
                <DateField value={vetNextDue} placeholder="Next visit due (optional)" field="vetNextDue" />
                <RecurrencePicker value={vetRecurrence} onChange={setVetRecurrence} />
                <TextInput style={styles.input} placeholder="Note (optional)" placeholderTextColor={C.textMuted} value={vetNote} onChangeText={setVetNote} />
                <View style={styles.formBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddVet(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={addVetCheck}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                </View>
              </View>
            )}
            {vetChecks.length > 0 && <Text style={styles.listTitle}>All Vet Visits</Text>}
            {vetChecks.map((v) => (
              <TouchableOpacity key={v.id} style={styles.listRow} onLongPress={() => deleteVetCheck(v.id)}>
                <View style={[styles.listIcon, { backgroundColor: "rgba(216,90,48,0.1)" }]}><Text style={{ fontSize: 16 }}>🏥</Text></View>
                <View style={styles.listInfo}>
                  <Text style={styles.listPrimary}>{v.reason}</Text>
                  <Text style={styles.listSecondary}>
                    {formatDate(v.date_done)}{v.vet_name ? ` · ${v.vet_name}` : ""}
                    {v.next_due ? ` · Next: ${formatDate(v.next_due)}` : ""}
                    {v.recurrence_weeks ? ` · Every ${v.recurrence_weeks}w` : ""}
                    {v.note ? ` · ${v.note}` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  backText: { color: C.text, fontSize: 18, fontWeight: "600" },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: "700" },

  // Tabs — scrollable
  tabScroll: { maxHeight: 56, marginBottom: 16 },
  tabRow: { paddingHorizontal: 20, gap: 6 },
  tab: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.md,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center",
  },
  tabActive: { backgroundColor: Palette.pawGold, borderColor: Palette.pawGold },
  tabEmoji: { fontSize: 16, marginBottom: 2 },
  tabText: { color: C.textSecondary, fontSize: 11, fontWeight: "600" },
  tabTextActive: { color: Palette.questNight, fontWeight: "700" },

  tabContent: { paddingHorizontal: 20 },

  // Current weight card
  currentCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.xl, padding: 20, alignItems: "center", marginBottom: 16,
  },
  currentLabel: { color: C.textSecondary, fontSize: 12, fontWeight: "500", marginBottom: 4 },
  currentValue: { color: C.text, fontSize: 36, fontWeight: "800", marginBottom: 4 },
  currentSub: { color: C.textSecondary, fontSize: 12 },
  changeBadge: { marginTop: 8, backgroundColor: C.background, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  changeText: { fontSize: 13, fontWeight: "600" },

  // Chart
  chartCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg, padding: 16, marginBottom: 16 },
  chartTitle: { color: C.text, fontSize: 14, fontWeight: "600", marginBottom: 12 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 4 },
  chartBar: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  chartBarLabel: { color: C.textMuted, fontSize: 8, marginBottom: 4 },
  chartBarFill: { width: "70%", backgroundColor: Palette.levelPurple, borderRadius: 3, minHeight: 4 },
  chartBarDate: { color: C.textMuted, fontSize: 7, marginTop: 4 },

  // Add button
  addBtn: { backgroundColor: Palette.pawGold, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center", marginBottom: 16 },
  addBtnText: { color: Palette.questNight, fontSize: 15, fontWeight: "700" },

  // Form
  formCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg, padding: 16, marginBottom: 16 },
  formTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 12 },
  fieldLabel: { color: C.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: Radius.md, padding: 12, color: C.text, fontSize: 14, marginBottom: 10 },
  dateField: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: Radius.md, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateFieldText: { color: C.text, fontSize: 14 },
  dateFieldPlaceholder: { color: C.textMuted, fontSize: 14 },
  dateFieldIcon: { fontSize: 16 },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: Radius.md, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: C.textSecondary, fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: Palette.pawGold, borderRadius: Radius.md, paddingVertical: 12, alignItems: "center" },
  saveBtnText: { color: Palette.questNight, fontSize: 14, fontWeight: "700" },

  // Type picker (horizontal chips)
  typePickerRow: { marginBottom: 10, maxHeight: 40 },
  typePickerChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: C.background, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  typePickerChipActive: { backgroundColor: Palette.levelPurple, borderColor: Palette.levelPurple },
  typePickerText: { color: C.textSecondary, fontSize: 13, fontWeight: "600" },
  typePickerTextActive: { color: "#fff" },

  // Recurrence picker
  recurrenceWrap: { marginBottom: 10 },
  recurrenceLabel: { color: C.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  recurrenceRow: { maxHeight: 36 },
  recurrenceChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: C.background, borderWidth: 1, borderColor: C.border, marginRight: 6 },
  recurrenceChipActive: { backgroundColor: Palette.streakGreen, borderColor: Palette.streakGreen },
  recurrenceChipText: { color: C.textSecondary, fontSize: 12, fontWeight: "600" },
  recurrenceChipTextActive: { color: "#fff" },

  // List
  listTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginBottom: 10, marginTop: 8 },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg, padding: 12, marginBottom: 8, gap: 12 },
  listIcon: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: "rgba(127,119,221,0.1)", alignItems: "center", justifyContent: "center" },
  listInfo: { flex: 1 },
  listPrimary: { color: C.text, fontSize: 15, fontWeight: "600" },
  listSecondary: { color: C.textSecondary, fontSize: 12, marginTop: 2 },

  activeBadge: { backgroundColor: "rgba(29,158,117,0.15)", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { color: Palette.streakGreen, fontSize: 11, fontWeight: "600" },

  hintText: { color: C.textMuted, fontSize: 11, textAlign: "center", marginTop: 8 },
});
