import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Palette } from "../constants/theme";
import { scheduleDailyReminder } from "../lib/notifications";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const setUserId = useStore((s) => s.setUserId);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setReady(true);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    // Günlük saat 19:00 hatırlatıcısını kur
    scheduleDailyReminder(19, 0);
  }, []);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.questNight },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="session" />
      <Stack.Screen name="levelup" />
      <Stack.Screen name="advisor" />
      <Stack.Screen name="tricks" />
    </Stack>
  );
}
