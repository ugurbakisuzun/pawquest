import { cancelNotification, scheduleDailyNotification, scheduleDateNotification } from "./notifications";
import { supabase } from "./supabase";

// ── Types ──

interface ReminderRow {
  id: string;
  dog_id: string;
  category: string;
  source_id: string | null;
  title: string;
  body: string;
  notification_id: string | null;
  schedule_type: string;
  hour: number | null;
  minute: number | null;
  interval_weeks: number | null;
  next_fire_date: string | null;
  active: boolean;
}

// ── Channel mapping ──

function channelForCategory(category: string): string {
  if (category === "feeding") return "feeding";
  if (category === "walking") return "walking";
  return "health";
}

// ── Schedule daily routine reminders (feeding / walking) ──

export async function scheduleRoutineReminders(
  dogId: string,
  dogName: string,
  category: "feeding" | "walking",
  times: string[], // ["08:00", "18:00"]
): Promise<void> {
  // Cancel existing reminders for this category
  await cancelRemindersForCategory(dogId, category);

  const channel = channelForCategory(category);
  const emoji = category === "feeding" ? "🍗" : "🚶";
  const label = category === "feeding" ? "Feeding" : "Walk";

  for (let i = 0; i < times.length; i++) {
    const [h, m] = times[i].split(":").map(Number);
    const ordinal = times.length > 1 ? ` #${i + 1}` : "";
    const title = `${emoji} ${label} time${ordinal} for ${dogName}!`;
    const body = category === "feeding"
      ? `Time to feed ${dogName}!`
      : `Time to take ${dogName} for a walk!`;

    const notifId = await scheduleDailyNotification(channel, title, body, h, m);

    await supabase.from("scheduled_reminders").insert({
      dog_id: dogId,
      category,
      title,
      body,
      notification_id: notifId,
      schedule_type: "daily",
      hour: h,
      minute: m,
      active: true,
    });
  }
}

// ── Schedule a one-shot reminder for a specific date ──

export async function scheduleDateReminder(
  dogId: string,
  dogName: string,
  category: string,
  sourceId: string,
  label: string,
  dueDate: string, // YYYY-MM-DD
): Promise<void> {
  const channel = channelForCategory(category);
  const emojiMap: Record<string, string> = {
    grooming: "✂️",
    vet: "🏥",
    vaccination: "💉",
    medication: "💊",
  };
  const emoji = emojiMap[category] ?? "🔔";
  const title = `${emoji} ${label} due for ${dogName}`;
  const body = `${dogName}'s ${label.toLowerCase()} is due today!`;

  const fireDate = new Date(dueDate + "T09:00:00");
  const notifId = await scheduleDateNotification(channel, title, body, fireDate, 9, 0);

  await supabase.from("scheduled_reminders").insert({
    dog_id: dogId,
    category,
    source_id: sourceId,
    title,
    body,
    notification_id: notifId,
    schedule_type: "date",
    hour: 9,
    minute: 0,
    next_fire_date: dueDate,
    active: true,
  });
}

// ── Schedule a recurring reminder (every N weeks) ──

export async function scheduleRecurringReminder(
  dogId: string,
  dogName: string,
  category: string,
  sourceId: string,
  label: string,
  startDate: string, // YYYY-MM-DD (next_due)
  intervalWeeks: number,
): Promise<void> {
  // Cancel any existing reminder for this source
  await cancelRemindersForSource(sourceId);

  const channel = channelForCategory(category);
  const emojiMap: Record<string, string> = {
    grooming: "✂️",
    vet: "🏥",
    vaccination: "💉",
    medication: "💊",
  };
  const emoji = emojiMap[category] ?? "🔔";
  const title = `${emoji} ${label} due for ${dogName}`;
  const body = `${dogName}'s ${label.toLowerCase()} is due today!`;

  const fireDate = new Date(startDate + "T09:00:00");
  const notifId = await scheduleDateNotification(channel, title, body, fireDate, 9, 0);

  await supabase.from("scheduled_reminders").insert({
    dog_id: dogId,
    category,
    source_id: sourceId,
    title,
    body,
    notification_id: notifId,
    schedule_type: "interval",
    hour: 9,
    minute: 0,
    interval_weeks: intervalWeeks,
    next_fire_date: startDate,
    active: true,
  });
}

// ── Cancel reminders for a specific source record ──

export async function cancelRemindersForSource(sourceId: string): Promise<void> {
  const { data } = await supabase
    .from("scheduled_reminders")
    .select("id, notification_id")
    .eq("source_id", sourceId)
    .eq("active", true);

  if (data) {
    for (const r of data) {
      if (r.notification_id) await cancelNotification(r.notification_id);
    }
    await supabase
      .from("scheduled_reminders")
      .update({ active: false })
      .eq("source_id", sourceId);
  }
}

// ── Cancel all reminders for a category (e.g. when updating routine) ──

export async function cancelRemindersForCategory(
  dogId: string,
  category: string,
): Promise<void> {
  const { data } = await supabase
    .from("scheduled_reminders")
    .select("id, notification_id")
    .eq("dog_id", dogId)
    .eq("category", category)
    .eq("active", true);

  if (data) {
    for (const r of data) {
      if (r.notification_id) await cancelNotification(r.notification_id);
    }
    await supabase
      .from("scheduled_reminders")
      .update({ active: false })
      .eq("dog_id", dogId)
      .eq("category", category);
  }
}

// ── Sync all reminders on app startup (re-schedule if needed) ──

export async function syncAllReminders(
  dogId: string,
  dogName: string,
): Promise<void> {
  const { data: reminders } = await supabase
    .from("scheduled_reminders")
    .select("*")
    .eq("dog_id", dogId)
    .eq("active", true);

  if (!reminders) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const r of reminders as ReminderRow[]) {
    const channel = channelForCategory(r.category);

    if (r.schedule_type === "daily" && r.hour != null && r.minute != null) {
      // Re-schedule daily reminders (they may have been lost on reinstall)
      const notifId = await scheduleDailyNotification(
        channel, r.title, r.body, r.hour, r.minute,
      );
      await supabase
        .from("scheduled_reminders")
        .update({ notification_id: notifId })
        .eq("id", r.id);
    }

    if (r.schedule_type === "interval" && r.next_fire_date && r.interval_weeks) {
      const nextDate = new Date(r.next_fire_date + "T00:00:00");
      if (nextDate < today) {
        // Missed — calculate next occurrence
        while (nextDate < today) {
          nextDate.setDate(nextDate.getDate() + r.interval_weeks * 7);
        }
        const newDateStr = nextDate.toISOString().split("T")[0];
        const fireDate = new Date(newDateStr + "T09:00:00");
        const notifId = await scheduleDateNotification(
          channel, r.title, r.body, fireDate, 9, 0,
        );
        await supabase
          .from("scheduled_reminders")
          .update({ notification_id: notifId, next_fire_date: newDateStr })
          .eq("id", r.id);
      }
    }

    if (r.schedule_type === "date" && r.next_fire_date) {
      const nextDate = new Date(r.next_fire_date + "T00:00:00");
      if (nextDate < today) {
        // Expired one-shot — deactivate
        await supabase
          .from("scheduled_reminders")
          .update({ active: false })
          .eq("id", r.id);
      }
    }
  }
}
