import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Palette } from "../constants/theme";
import { ensureNotificationChannels, scheduleDailyReminder } from "../lib/notifications";
import { syncAllReminders } from "../lib/reminders";
import { initPurchases, loginUser, logoutUser } from "../lib/purchases";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const setUserId = useStore((s) => s.setUserId);
  const setDog = useStore((s) => s.setDog);
  const loadProStatus = useStore((s) => s.loadProStatus);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);

      if (uid) {
        // Pre-load the dog profile so index.tsx can redirect immediately
        // without flashing the onboarding screen.
        const { data: dogData } = await supabase
          .from("dogs")
          .select("*")
          .eq("owner_id", uid)
          .limit(1)
          .single();
        if (dogData) {
          setDog(dogData);
          // Sync reminders on startup (re-register after reinstall/restart)
          syncAllReminders(dogData.id, dogData.name).catch(() => {});
        }

        await initPurchases(uid);
        await loadProStatus();
      }

      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        if (uid) {
          await loginUser(uid);
          await loadProStatus();
        } else {
          setDog(null);
          await logoutUser();
        }
      },
    );

    ensureNotificationChannels();
    scheduleDailyReminder(19, 0);

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Palette.boneWhite },
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
        <Stack.Screen name="routine-setup" options={{ presentation: "modal", gestureEnabled: false }} />
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      </Stack>
    </ErrorBoundary>
  );
}
