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
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.light;

type EventType = "program" | "trick" | "walk" | "medication" | "vaccination" | "grooming" | "vet";

interface CalendarEvent {
  type: EventType;
  label: string;
  detail?: string;
  completed_at: string;
}

interface WeekDay {
  date: Date;
  dateStr: string;
  label: string;
  dayLetter: string;
  events: CalendarEvent[];
  isToday: boolean;
  isFuture: boolean;
}

const TYPE_META: Record<EventType, { emoji: string; color: string; label: string }> = {
  program:     { emoji: "🐾", color: "#1D9E75", label: "Training" },
  trick:       { emoji: "🎯", color: "#7F77DD", label: "Trick" },
  walk:        { emoji: "🚶", color: "#FAC775", label: "Walk" },
  medication:  { emoji: "💊", color: "#E76F51", label: "Medication" },
  vaccination: { emoji: "💉", color: "#5BC0EB", label: "Vaccination" },
  grooming:    { emoji: "✂️", color: "#9B59B6", label: "Grooming" },
  vet:         { emoji: "🏥", color: "#D85A30", label: "Vet" },
};

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekDays(weeksBack = 0): WeekDay[] {
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const days: WeekDay[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i - weeksBack * 7);
    const dateStr = toLocalDateStr(date);
    const isToday = dateStr === todayStr;
    const isFuture = date > today && !isToday;
    days.push({
      date,
      dateStr,
      label: date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      dayLetter: date
        .toLocaleDateString("en-GB", { weekday: "short" })
        .slice(0, 1),
      events: [],
      isToday,
      isFuture,
    });
  }
  return days;
}

export default function CalendarScreen() {
  const { dog } = useStore();
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeksBack, setWeeksBack] = useState(0);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null);

  useEffect(() => {
    if (dog) loadAllEvents();
    else setLoading(false);
  }, [dog]);

  useEffect(() => {
    const days = getWeekDays(weeksBack);
    days.forEach((day) => {
      day.events = allEvents.filter((s) => {
        const localStr = toLocalDateStr(new Date(s.completed_at));
        return localStr === day.dateStr;
      });
    });
    setWeekDays(days);
    const today = days.find((d) => d.isToday);
    if (today) setSelectedDay(today);
  }, [weeksBack, allEvents]);

  const loadAllEvents = async () => {
    if (!dog) {
      setLoading(false);
      return;
    }
    try {
      // Run all queries in parallel
      const [
        { data: sessions },
        { data: tricks },
        { data: walks },
        { data: vaxes },
        { data: meds },
        { data: grooms },
        { data: vets },
        { data: progs },
      ] = await Promise.all([
        supabase
          .from("training_sessions")
          .select("day_number, program_slug, completed_at")
          .eq("dog_id", dog.id)
          .order("completed_at", { ascending: true }),
        supabase
          .from("completed_tricks")
          .select("completed_at, tricks(name)")
          .eq("dog_id", dog.id)
          .order("completed_at", { ascending: true }),
        supabase
          .from("walks")
          .select("completed_at, distance_meters, duration_seconds")
          .eq("dog_id", dog.id)
          .order("completed_at", { ascending: true }),
        supabase
          .from("vaccinations")
          .select("name, date_given")
          .eq("dog_id", dog.id)
          .order("date_given", { ascending: true }),
        supabase
          .from("medications")
          .select("name, dosage, start_date")
          .eq("dog_id", dog.id)
          .order("start_date", { ascending: true }),
        supabase
          .from("grooming_logs")
          .select("grooming_type, date_done, note")
          .eq("dog_id", dog.id)
          .order("date_done", { ascending: true }),
        supabase
          .from("vet_checks")
          .select("reason, date_done, vet_name")
          .eq("dog_id", dog.id)
          .order("date_done", { ascending: true }),
        supabase
          .from("training_programs")
          .select("slug, title"),
      ]);

      const slugToTitle: Record<string, string> = {};
      (progs ?? []).forEach((p: any) => { slugToTitle[p.slug] = p.title; });

      const programEvents: CalendarEvent[] = (sessions ?? []).map((s: any) => ({
        type: "program",
        label: `${slugToTitle[s.program_slug] ?? "Training"} · Day ${s.day_number}`,
        completed_at: s.completed_at,
      }));

      const trickEvents: CalendarEvent[] = (tricks ?? []).map((t: any) => ({
        type: "trick",
        label: t.tricks?.name ?? "Trick",
        completed_at: t.completed_at,
      }));

      const walkEvents: CalendarEvent[] = (walks ?? []).map((w: any) => {
        const km = (w.distance_meters / 1000).toFixed(1);
        const min = Math.round(w.duration_seconds / 60);
        return {
          type: "walk",
          label: `Walk · ${km} km`,
          detail: `${min} min`,
          completed_at: w.completed_at,
        };
      });

      const vaxEvents: CalendarEvent[] = (vaxes ?? []).map((v: any) => ({
        type: "vaccination",
        label: v.name,
        detail: "Vaccination",
        // date_given is just a date — convert to ISO so getTime works
        completed_at: new Date(v.date_given).toISOString(),
      }));

      const medEvents: CalendarEvent[] = (meds ?? []).map((m: any) => ({
        type: "medication",
        label: m.name,
        detail: m.dosage ? `Started · ${m.dosage}` : "Started",
        completed_at: new Date(m.start_date).toISOString(),
      }));

      const groomEvents: CalendarEvent[] = (grooms ?? []).map((g: any) => ({
        type: "grooming" as EventType,
        label: g.grooming_type,
        detail: g.note ?? "Grooming",
        completed_at: new Date(g.date_done).toISOString(),
      }));

      const vetEvents: CalendarEvent[] = (vets ?? []).map((v: any) => ({
        type: "vet" as EventType,
        label: v.reason,
        detail: v.vet_name ?? "Vet visit",
        completed_at: new Date(v.date_done).toISOString(),
      }));

      const combined = [
        ...programEvents,
        ...trickEvents,
        ...walkEvents,
        ...vaxEvents,
        ...medEvents,
        ...groomEvents,
        ...vetEvents,
      ].sort(
        (a, b) =>
          new Date(a.completed_at).getTime() -
          new Date(b.completed_at).getTime(),
      );

      setAllEvents(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const counts: Record<EventType, number> = {
    program: 0, trick: 0, walk: 0, medication: 0, vaccination: 0, grooming: 0, vet: 0,
  };
  allEvents.forEach((e) => { counts[e.type]++; });

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.pawGold} />
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>
            {dog?.name ?? "Your dog"} · All activity
          </Text>
        </View>

        {/* ── Stats Card ── */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statEmoji}>🐾</Text>
              <Text style={styles.statVal}>{counts.program}</Text>
              <Text style={styles.statLbl}>Training</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statEmoji}>🎯</Text>
              <Text style={styles.statVal}>{counts.trick}</Text>
              <Text style={styles.statLbl}>Tricks</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statEmoji}>🚶</Text>
              <Text style={styles.statVal}>{counts.walk}</Text>
              <Text style={styles.statLbl}>Walks</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={[styles.statVal, { color: Palette.streakGreen }]}>
                {dog?.streak_days ?? 0}
              </Text>
              <Text style={styles.statLbl}>Streak</Text>
            </View>
          </View>
        </View>

        {/* ── Week Navigation ── */}
        <View style={styles.weekNav}>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={() => setWeeksBack(weeksBack + 1)}
          >
            <Text style={styles.weekNavText}>← Prev</Text>
          </TouchableOpacity>
          <Text style={styles.weekNavTitle}>
            {weeksBack === 0
              ? "This week"
              : weeksBack === 1
                ? "Last week"
                : `${weeksBack} weeks ago`}
          </Text>
          <TouchableOpacity
            style={[
              styles.weekNavBtn,
              weeksBack === 0 && styles.weekNavBtnDisabled,
            ]}
            onPress={() => weeksBack > 0 && setWeeksBack(weeksBack - 1)}
          >
            <Text
              style={[
                styles.weekNavText,
                weeksBack === 0 && styles.weekNavTextDisabled,
              ]}
            >
              Next →
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Week Grid ── */}
        <View style={styles.weekGrid}>
          {weekDays.map((day, index) => {
            const hasEvents = day.events.length > 0;
            const isSelected = selectedDay?.dateStr === day.dateStr;
            // Get unique types for dot row
            const typeSet = new Set(day.events.map((e) => e.type));
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  hasEvents && styles.dayCellDone,
                  day.isToday && styles.dayCellToday,
                  isSelected && styles.dayCellSelected,
                  day.isFuture && styles.dayCellFuture,
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text
                  style={[
                    styles.dayLetter,
                    day.isToday && styles.dayLetterToday,
                  ]}
                >
                  {day.dayLetter}
                </Text>
                <Text style={[styles.dayNum, hasEvents && styles.dayNumDone]}>
                  {day.date.getDate()}
                </Text>
                <View style={styles.dotRow}>
                  {[...typeSet].slice(0, 4).map((t) => (
                    <View
                      key={t}
                      style={[styles.dayDot, { backgroundColor: TYPE_META[t].color }]}
                    />
                  ))}
                  {day.isToday && !hasEvents && (
                    <View style={[styles.dayDot, { backgroundColor: Palette.pawGold }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Dot legend ── */}
        <View style={styles.legend}>
          {(Object.keys(TYPE_META) as EventType[]).map((t) => (
            <View key={t} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: TYPE_META[t].color }]} />
              <Text style={styles.legendText}>{TYPE_META[t].label}</Text>
            </View>
          ))}
        </View>

        {/* ── Selected Day Detail ── */}
        {selectedDay && (
          <View style={styles.dayDetail}>
            <Text style={styles.dayDetailDate}>
              {selectedDay.isToday ? "Today" : selectedDay.label}
              {selectedDay.events.length > 0 && " ✅"}
            </Text>
            {selectedDay.events.length > 0 ? (
              selectedDay.events.map((e, i) => {
                const meta = TYPE_META[e.type];
                return (
                  <View key={i} style={styles.eventRow}>
                    <View
                      style={[
                        styles.eventIcon,
                        { backgroundColor: meta.color + "22" },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle}>{e.label}</Text>
                      <Text style={styles.eventTime}>
                        {e.detail
                          ? `${e.detail} · `
                          : ""}
                        {new Date(e.completed_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : selectedDay.isFuture ? (
              <Text style={styles.dayDetailEmpty}>Future day 📅</Text>
            ) : (
              <View style={styles.restDayRow}>
                <Text style={styles.dayDetailEmpty}>Rest day 💤</Text>
                {selectedDay.isToday && (
                  <TouchableOpacity
                    style={styles.trainNowBtn}
                    onPress={() => router.push("/dashboard" as any)}
                  >
                    <Text style={styles.trainNowText}>Train now →</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── All Activity ── */}
        <Text style={styles.allSessionsTitle}>All Activity</Text>
        {allEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No activity yet — start your first training! 🐾
            </Text>
          </View>
        ) : (
          [...allEvents].reverse().map((e, i) => {
            const meta = TYPE_META[e.type];
            return (
              <View key={i} style={styles.allRow}>
                <View
                  style={[
                    styles.allRowIcon,
                    { backgroundColor: meta.color + "22" },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                </View>
                <View style={styles.allRowBody}>
                  <Text style={styles.allRowTitle} numberOfLines={1}>{e.label}</Text>
                  <Text style={styles.allRowSub}>
                    {new Date(e.completed_at).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.allRowBadge,
                    { backgroundColor: meta.color + "22" },
                  ]}
                >
                  <Text style={[styles.allRowBadgeText, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {/* ── Health & Tracking ── */}
        <View style={styles.trackingSection}>
          <Text style={styles.trackingSectionTitle}>Health & Tracking</Text>
          <TouchableOpacity
            style={styles.trackingLink}
            onPress={() => router.push("/health?tab=weight" as any)}
          >
            <Text style={styles.trackingLinkIcon}>⚖️</Text>
            <Text style={styles.trackingLinkText}>Weight Log</Text>
            <Text style={styles.trackingLinkArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trackingLink}
            onPress={() => router.push("/health?tab=vaccinations" as any)}
          >
            <Text style={styles.trackingLinkIcon}>💉</Text>
            <Text style={styles.trackingLinkText}>Vaccinations</Text>
            <Text style={styles.trackingLinkArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trackingLink}
            onPress={() => router.push("/health?tab=medications" as any)}
          >
            <Text style={styles.trackingLinkIcon}>💊</Text>
            <Text style={styles.trackingLinkText}>Medications</Text>
            <Text style={styles.trackingLinkArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trackingLink}
            onPress={() => router.push("/health?tab=grooming" as any)}
          >
            <Text style={styles.trackingLinkIcon}>✂️</Text>
            <Text style={styles.trackingLinkText}>Grooming</Text>
            <Text style={styles.trackingLinkArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trackingLink}
            onPress={() => router.push("/health?tab=vet" as any)}
          >
            <Text style={styles.trackingLinkIcon}>🏥</Text>
            <Text style={styles.trackingLinkText}>Vet Checks</Text>
            <Text style={styles.trackingLinkArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Health & Tracking ──
  trackingSection: {
    marginHorizontal: Spacing.xl,
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 20,
  },
  trackingSectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  trackingLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  trackingLinkIcon: { fontSize: 20, width: 32 },
  trackingLinkText: { flex: 1, color: C.text, fontSize: 15, fontWeight: "600" },
  trackingLinkArrow: { color: C.textMuted, fontSize: 16 },

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

  statsCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.xl,
    padding: 18,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  statBlock: { alignItems: "center", flex: 1 },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statVal: { color: C.text, fontSize: 20, fontWeight: "700" },
  statLbl: { color: C.textSecondary, fontSize: 11, marginTop: 2 },

  weekNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    marginBottom: 12,
  },
  weekNavBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  weekNavBtnDisabled: { opacity: 0.3 },
  weekNavText: { color: C.accent, fontSize: 13, fontWeight: "600" },
  weekNavTextDisabled: { color: C.textMuted },
  weekNavTitle: { color: C.text, fontSize: 14, fontWeight: "600" },

  weekGrid: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    gap: 6,
    marginBottom: 8,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    gap: 3,
  },
  dayCellDone: {
    backgroundColor: "rgba(29,158,117,0.12)",
    borderColor: "rgba(29,158,117,0.3)",
  },
  dayCellToday: { borderColor: Palette.pawGold, borderWidth: 1.5 },
  dayCellSelected: {
    backgroundColor: "rgba(250,199,117,0.12)",
    borderColor: Palette.pawGold,
  },
  dayCellFuture: { opacity: 0.4 },
  dayLetter: { color: C.textSecondary, fontSize: 10, fontWeight: "600" },
  dayLetterToday: { color: C.xp },
  dayNum: { color: C.text, fontSize: 14, fontWeight: "600" },
  dayNumDone: { color: C.success },
  dotRow: { flexDirection: "row", gap: 3, alignItems: "center", height: 6 },
  dayDot: { width: 5, height: 5, borderRadius: 3 },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: C.textSecondary, fontSize: 11 },

  dayDetail: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 16,
  },
  dayDetailDate: {
    color: C.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  dayDetailEmpty: { color: C.textSecondary, fontSize: 13 },
  restDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trainNowBtn: {
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  trainNowText: { color: Palette.questNight, fontSize: 12, fontWeight: "700" },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  eventTitle: { color: C.text, fontSize: 13, fontWeight: "600" },
  eventTime: { color: C.textSecondary, fontSize: 11, marginTop: 2 },

  allSessionsTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: Spacing.xl,
    marginBottom: 12,
  },
  emptyCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { color: C.textSecondary, fontSize: 13, textAlign: "center" },
  allRow: {
    marginHorizontal: Spacing.xl,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  allRowIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  allRowBody: { flex: 1, gap: 2 },
  allRowTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  allRowSub: { color: C.textSecondary, fontSize: 12 },
  allRowBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  allRowBadgeText: { fontSize: 11, fontWeight: "700" },
});
