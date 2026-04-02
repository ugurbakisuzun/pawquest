import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleDailyReminder(
  hour = 19,
  minute = 0,
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const granted = await requestNotificationPermission();
  if (!granted) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("training", {
      name: "Training Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to train! 🐾",
      body: "Your daily session is waiting. Keep that streak alive!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function sendSessionCompleteNotification(
  dogName: string,
  xpEarned: number,
  streakDays: number,
): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Great session, ${dogName}! 🎉`,
      body: `+${xpEarned} XP earned · ${streakDays}-day streak 🔥`,
      sound: true,
    },
    trigger: null,
  });
}
