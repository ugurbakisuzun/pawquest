import { Platform } from "react-native";

let Notifications: any = null;
try {
  Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {}

// ── Permission ──

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// ── Android Channels ──

export async function ensureNotificationChannels(): Promise<void> {
  if (!Notifications || Platform.OS !== "android") return;
  const channels = [
    { id: "training", name: "Training Reminders" },
    { id: "feeding", name: "Feeding Reminders" },
    { id: "walking", name: "Walking Reminders" },
    { id: "health", name: "Health Reminders" },
  ];
  for (const ch of channels) {
    await Notifications.setNotificationChannelAsync(ch.id, {
      name: ch.name,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }
}

// ── Stored training reminder ID for cancel-by-ID ──

let trainingReminderId: string | null = null;

export async function scheduleDailyReminder(
  hour = 19,
  minute = 0,
): Promise<void> {
  if (!Notifications) return;
  try {
    // Cancel only the previous training reminder, not all
    if (trainingReminderId) {
      await Notifications.cancelScheduledNotificationAsync(trainingReminderId);
    }
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await ensureNotificationChannels();

    trainingReminderId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to train! 🐾",
        body: "Your daily session is waiting. Keep that streak alive!",
        sound: true,
        ...(Platform.OS === "android" && { channelId: "training" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {}
}

// ── Schedule a daily recurring notification at a specific time ──

export async function scheduleDailyNotification(
  channelId: string,
  title: string,
  body: string,
  hour: number,
  minute: number,
): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    await ensureNotificationChannels();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === "android" && { channelId }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch {
    return null;
  }
}

// ── Schedule a one-shot notification for a specific date ──

export async function scheduleDateNotification(
  channelId: string,
  title: string,
  body: string,
  date: Date,
  hour = 9,
  minute = 0,
): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    await ensureNotificationChannels();

    const fireDate = new Date(date);
    fireDate.setHours(hour, minute, 0, 0);

    // Don't schedule in the past
    if (fireDate.getTime() <= Date.now()) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === "android" && { channelId }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
    return id;
  } catch {
    return null;
  }
}

// ── Cancel a specific notification by ID ──

export async function cancelNotification(notificationId: string): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
}

// ── Immediate notification ──

export async function sendSessionCompleteNotification(
  dogName: string,
  xpEarned: number,
  streakDays: number,
): Promise<void> {
  if (!Notifications) return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await ensureNotificationChannels();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Great session, ${dogName}! 🎉`,
        body: `+${xpEarned} XP earned · ${streakDays}-day streak 🔥`,
        sound: true,
        ...(Platform.OS === "android" && { channelId: "training" }),
      },
      trigger: null,
    });
  } catch {}
}
