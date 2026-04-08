import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Palette } from "../constants/theme";
import { scheduleDailyReminder } from "../lib/notifications";
import { initPurchases, loginUser, logoutUser } from "../lib/purchases";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const setUserId = useStore((s) => s.setUserId);
  const loadProStatus = useStore((s) => s.loadProStatus);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      await initPurchases(uid);
      await loadProStatus();
      setReady(true);
    });
    supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        await loginUser(uid);
        await loadProStatus();
      } else {
        await logoutUser();
      }
    });
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
      <Stack.Screen name="calendar" />
      <Stack.Screen name="badges" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="walk" />
      <Stack.Screen name="walkdetail" />
      <Stack.Screen name="health" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
    </Stack>
  );
}
