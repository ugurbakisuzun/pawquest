import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MapView, Marker, Polyline } from "../components/MapViewSafe";
import { Colors, Palette, Radius } from "../constants/theme";
import { computeLevel, useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.dark;
const { width: SCREEN_W } = Dimensions.get("window");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcWalkXP(meters: number, seconds: number): number {
  const distXP = Math.floor(meters / 100);
  const timeXP = Math.floor(seconds / 120);
  return Math.max(10, Math.min(distXP + timeXP, 100));
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function formatPace(meters: number, sec: number): string {
  if (meters <= 0 || sec <= 0) return "--:--";
  const minPerKm = (sec / 60) / (meters / 1000);
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")} /km`;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type WalkState = "idle" | "walking" | "paused" | "done";

interface Coord {
  latitude: number;
  longitude: number;
}

export default function WalkScreen() {
  const { dog, setDog, loadBadges, checkAndAwardBadges } = useStore();
  const [walkState, setWalkState] = useState<WalkState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [currentPos, setCurrentPos] = useState<Coord | null>(null);
  const [saving, setSaving] = useState(false);
  const [recentWalks, setRecentWalks] = useState<any[]>([]);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<Date | null>(null);
  const mapRef = useRef<any>(null);
  const distRef = useRef(0); // avoid stale closure

  useEffect(() => {
    getInitialLocation();
    loadRecentWalks();
    return () => {
      locationSub.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const getInitialLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCurrentPos({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
  };

  const loadRecentWalks = async () => {
    if (!dog) return;
    const { data } = await supabase
      .from("walks")
      .select("*")
      .eq("dog_id", dog.id)
      .order("completed_at", { ascending: false })
      .limit(10);
    setRecentWalks(data ?? []);
  };

  // ── Walk controls ──

  const startWalk = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location Required", "Enable location access to track your walk.");
      return;
    }

    setWalkState("walking");
    setSeconds(0);
    setDistance(0);
    setCoords([]);
    distRef.current = 0;
    startedAt.current = new Date();

    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 3,
      },
      (loc) => {
        const newCoord: Coord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCurrentPos(newCoord);

        setCoords((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.latitude, last.longitude, newCoord.latitude, newCoord.longitude);
            // Filter GPS noise: ignore < 1m or > 100m jumps
            if (d < 1 || d > 100) return prev;
            distRef.current += d;
            setDistance(distRef.current);
          }
          return [...prev, newCoord];
        });

        // Auto-center map
        mapRef.current?.animateToRegion({
          ...newCoord,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 500);
      },
    );
  };

  const pauseWalk = () => {
    setWalkState("paused");
    locationSub.current?.remove();
    locationSub.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const resumeWalk = async () => {
    setWalkState("walking");
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 3,
      },
      (loc) => {
        const newCoord: Coord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCurrentPos(newCoord);

        setCoords((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last.latitude, last.longitude, newCoord.latitude, newCoord.longitude);
            if (d < 1 || d > 100) return prev;
            distRef.current += d;
            setDistance(distRef.current);
          }
          return [...prev, newCoord];
        });

        mapRef.current?.animateToRegion({
          ...newCoord,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 500);
      },
    );
  };

  const finishWalk = () => {
    Alert.alert(
      "Finish Walk?",
      `${formatDistance(distance)} · ${formatDuration(seconds)}\n\nSave this walk?`,
      [
        { text: "Keep going", style: "cancel" },
        { text: "Finish & earn XP", onPress: saveWalk },
      ],
    );
  };

  const saveWalk = async () => {
    if (!dog) return;
    setSaving(true);
    locationSub.current?.remove(); locationSub.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const xp = calcWalkXP(distance, seconds);

    try {
      const routeData = coords.length > 300
        ? coords.filter((_, i) => i % Math.ceil(coords.length / 300) === 0)
        : coords;

      await supabase.from("walks").insert({
        dog_id: dog.id,
        duration_seconds: seconds,
        distance_meters: Math.round(distance),
        xp_earned: xp,
        route: routeData.map((c) => ({ lat: c.latitude, lng: c.longitude })),
        started_at: startedAt.current?.toISOString(),
        completed_at: new Date().toISOString(),
      });

      const newXP = dog.total_xp + xp;
      const newLevel = computeLevel(newXP);
      const { data } = await supabase
        .from("dogs")
        .update({ total_xp: newXP, level: newLevel, last_trained_at: new Date().toISOString() })
        .eq("id", dog.id)
        .select()
        .single();
      if (data) setDog(data);

      await supabase.from("xp_events").insert({
        dog_id: dog.id, amount: xp,
        reason: `Walk: ${formatDistance(distance)} in ${formatDuration(seconds)}`,
      });

      await loadBadges(dog.id);
      await checkAndAwardBadges(dog.id);
      setWalkState("done");
      await loadRecentWalks();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save walk.");
    } finally {
      setSaving(false);
    }
  };

  const discardWalk = () => {
    Alert.alert("Discard Walk?", "This walk won't be saved.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard", style: "destructive",
        onPress: () => {
          locationSub.current?.remove();
          if (timerRef.current) clearInterval(timerRef.current);
          setWalkState("idle");
          setSeconds(0);
          setDistance(0);
          setCoords([]);
          distRef.current = 0;
        },
      },
    ]);
  };

  const xpPreview = calcWalkXP(distance, seconds);

  // Map region
  const mapRegion = currentPos
    ? { ...currentPos, latitudeDelta: 0.008, longitudeDelta: 0.008 }
    : { latitude: 51.5074, longitude: -0.1278, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  // ── Render ──

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (walkState === "walking" || walkState === "paused") {
            Alert.alert("Walk in progress", "Finish or discard your walk first.");
            return;
          }
          router.back();
        }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {walkState === "idle" ? "Walk Tracker" : walkState === "done" ? "Walk Complete!" : "Walking..."}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ══════ IDLE ══════ */}
      {walkState === "idle" && (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {/* Map preview */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              showsUserLocation
              showsMyLocationButton={false}
              userInterfaceStyle="dark"
            />
            <View style={styles.mapOverlay}>
              <TouchableOpacity style={styles.startBtn} onPress={startWalk}>
                <Text style={styles.startBtnText}>Start Walk 🚶</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* XP info */}
          <View style={styles.xpInfo}>
            <Text style={styles.xpInfoTitle}>How XP works</Text>
            <View style={styles.xpInfoRow}><Text style={styles.xpDot}>📏</Text><Text style={styles.xpInfoText}>1 XP per 100m walked</Text></View>
            <View style={styles.xpInfoRow}><Text style={styles.xpDot}>⏱️</Text><Text style={styles.xpInfoText}>1 XP per 2 minutes</Text></View>
            <View style={styles.xpInfoRow}><Text style={styles.xpDot}>⭐</Text><Text style={styles.xpInfoText}>Min 10 XP · Max 100 XP per walk</Text></View>
          </View>

          {/* Recent walks */}
          {recentWalks.length > 0 && (
            <>
              <Text style={styles.recentTitle}>Recent Walks</Text>
              {recentWalks.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={styles.walkCard}
                  onPress={() => router.push(`/walkdetail?id=${w.id}` as any)}
                >
                  <View style={styles.walkCardIcon}><Text style={{ fontSize: 18 }}>🐾</Text></View>
                  <View style={styles.walkCardInfo}>
                    <Text style={styles.walkCardDist}>{formatDistance(w.distance_meters)}</Text>
                    <Text style={styles.walkCardMeta}>
                      {formatDuration(w.duration_seconds)} · {formatPace(w.distance_meters, w.duration_seconds)} · {new Date(w.completed_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.walkCardRight}>
                    <Text style={styles.walkCardXP}>+{w.xp_earned} XP</Text>
                    <Text style={styles.walkCardArrow}>→</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ══════ WALKING / PAUSED ══════ */}
      {(walkState === "walking" || walkState === "paused") && (
        <View style={{ flex: 1 }}>
          {/* Map with route */}
          <View style={styles.mapContainerLive}>
            <MapView
              ref={mapRef}
              style={styles.mapLive}
              initialRegion={mapRegion}
              showsUserLocation
              showsMyLocationButton={false}
              userInterfaceStyle="dark"
            >
              {coords.length >= 2 && (
                <Polyline
                  coordinates={coords}
                  strokeColor={Palette.streakGreen}
                  strokeWidth={4}
                />
              )}
              {coords.length > 0 && (
                <Marker coordinate={coords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.startMarker}><Text style={{ fontSize: 10 }}>🟢</Text></View>
                </Marker>
              )}
            </MapView>

            {/* Floating stats */}
            <View style={styles.floatingStats}>
              <View style={styles.floatStat}>
                <Text style={styles.floatValue}>{formatDistance(distance)}</Text>
                <Text style={styles.floatLabel}>Distance</Text>
              </View>
              <View style={styles.floatDivider} />
              <View style={styles.floatStat}>
                <Text style={styles.floatValue}>{formatDuration(seconds)}</Text>
                <Text style={styles.floatLabel}>Duration</Text>
              </View>
              <View style={styles.floatDivider} />
              <View style={styles.floatStat}>
                <Text style={styles.floatValue}>{formatPace(distance, seconds)}</Text>
                <Text style={styles.floatLabel}>Pace</Text>
              </View>
            </View>

            {/* GPS + XP */}
            <View style={styles.floatingXP}>
              <View style={[styles.gpsDot, walkState === "walking" && styles.gpsDotActive]} />
              <Text style={styles.floatingXPText}>⭐ +{xpPreview} XP</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <View style={styles.controlRow}>
              {walkState === "walking" ? (
                <TouchableOpacity style={styles.pauseBtn} onPress={pauseWalk}>
                  <Text style={styles.ctrlBtnText}>⏸️ Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.resumeBtn} onPress={resumeWalk}>
                  <Text style={styles.ctrlBtnTextDark}>▶️ Resume</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.finishBtn} onPress={finishWalk} disabled={saving}>
                <Text style={styles.ctrlBtnTextDark}>
                  {saving ? "Saving..." : `✅ Finish`}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.discardBtn} onPress={discardWalk}>
              <Text style={styles.discardText}>Discard walk</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══════ DONE ══════ */}
      {walkState === "done" && (
        <View style={{ flex: 1 }}>
          {/* Map showing completed route */}
          <View style={styles.mapContainerDone}>
            <MapView
              style={styles.mapDone}
              initialRegion={
                coords.length > 0
                  ? { ...coords[Math.floor(coords.length / 2)], latitudeDelta: 0.01, longitudeDelta: 0.01 }
                  : mapRegion
              }
              showsUserLocation={false}
              userInterfaceStyle="dark"
            >
              {coords.length >= 2 && (
                <Polyline coordinates={coords} strokeColor={Palette.pawGold} strokeWidth={4} />
              )}
              {coords.length > 0 && (
                <Marker coordinate={coords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.routeMarker}><Text style={{ fontSize: 12 }}>🟢</Text></View>
                </Marker>
              )}
              {coords.length > 1 && (
                <Marker coordinate={coords[coords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.routeMarker}><Text style={{ fontSize: 12 }}>🏁</Text></View>
                </Marker>
              )}
            </MapView>
          </View>

          {/* Stats */}
          <View style={styles.doneContent}>
            <Text style={styles.doneTitle}>Great walk! 🎉</Text>
            <View style={styles.doneStats}>
              <View style={styles.doneStat}>
                <Text style={styles.doneVal}>{formatDistance(distance)}</Text>
                <Text style={styles.doneLbl}>Distance</Text>
              </View>
              <View style={styles.doneStat}>
                <Text style={styles.doneVal}>{formatDuration(seconds)}</Text>
                <Text style={styles.doneLbl}>Duration</Text>
              </View>
              <View style={styles.doneStat}>
                <Text style={[styles.doneVal, { color: Palette.pawGold }]}>+{calcWalkXP(distance, seconds)}</Text>
                <Text style={styles.doneLbl}>XP</Text>
              </View>
            </View>
            <Text style={styles.donePace}>Avg pace: {formatPace(distance, seconds)}</Text>

            <TouchableOpacity style={styles.againBtn} onPress={() => {
              setWalkState("idle"); setSeconds(0); setDistance(0); setCoords([]); distRef.current = 0;
            }}>
              <Text style={styles.againBtnText}>Walk again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.back()}>
              <Text style={styles.homeBtnText}>Back to home</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 8,
    zIndex: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  backText: { color: C.text, fontSize: 18, fontWeight: "600" },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: "700" },

  // Idle map
  mapContainer: { height: 280, marginHorizontal: 20, borderRadius: Radius.xl, overflow: "hidden", marginBottom: 16 },
  map: { ...StyleSheet.absoluteFillObject },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end", alignItems: "center", paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  startBtn: {
    backgroundColor: Palette.streakGreen, borderRadius: Radius.full,
    paddingVertical: 16, paddingHorizontal: 48,
  },
  startBtnText: { color: Palette.questNight, fontSize: 18, fontWeight: "700" },

  // XP info
  xpInfo: {
    marginHorizontal: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 16, marginBottom: 20, gap: 8,
  },
  xpInfoTitle: { color: C.text, fontSize: 14, fontWeight: "600", marginBottom: 4 },
  xpInfoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  xpDot: { fontSize: 14 },
  xpInfoText: { color: C.textSecondary, fontSize: 13 },

  // Recent
  recentTitle: { color: C.text, fontSize: 16, fontWeight: "700", paddingHorizontal: 20, marginBottom: 10 },
  walkCard: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 8,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 12, gap: 10,
  },
  walkCardIcon: {
    width: 38, height: 38, borderRadius: Radius.md, backgroundColor: "rgba(29,158,117,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  walkCardInfo: { flex: 1 },
  walkCardDist: { color: C.text, fontSize: 15, fontWeight: "700" },
  walkCardMeta: { color: C.textSecondary, fontSize: 11, marginTop: 2 },
  walkCardRight: { alignItems: "flex-end", gap: 2 },
  walkCardXP: { color: Palette.pawGold, fontSize: 14, fontWeight: "700" },
  walkCardArrow: { color: C.textMuted, fontSize: 12 },

  // Live map
  mapContainerLive: { flex: 1, position: "relative" },
  mapLive: { ...StyleSheet.absoluteFillObject },
  startMarker: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  floatingStats: {
    position: "absolute", top: 12, left: 12, right: 12,
    backgroundColor: "rgba(15,11,46,0.9)", borderRadius: Radius.lg,
    flexDirection: "row", padding: 12,
  },
  floatStat: { flex: 1, alignItems: "center" },
  floatValue: { color: C.text, fontSize: 16, fontWeight: "700" },
  floatLabel: { color: C.textSecondary, fontSize: 10, marginTop: 2 },
  floatDivider: { width: 1, backgroundColor: C.border, marginVertical: 2 },
  floatingXP: {
    position: "absolute", bottom: 12, left: 12,
    backgroundColor: "rgba(15,11,46,0.9)", borderRadius: Radius.full,
    flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 14, gap: 6,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.textMuted },
  gpsDotActive: { backgroundColor: Palette.streakGreen },
  floatingXPText: { color: Palette.pawGold, fontSize: 13, fontWeight: "600" },

  // Controls
  controls: { backgroundColor: C.background, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 36 : 20 },
  controlRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  pauseBtn: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center",
  },
  resumeBtn: {
    flex: 1, backgroundColor: Palette.streakGreen, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: "center",
  },
  finishBtn: {
    flex: 1, backgroundColor: Palette.pawGold, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: "center",
  },
  ctrlBtnText: { color: C.text, fontSize: 15, fontWeight: "600" },
  ctrlBtnTextDark: { color: Palette.questNight, fontSize: 15, fontWeight: "700" },
  discardBtn: { alignItems: "center", paddingVertical: 8 },
  discardText: { color: C.textMuted, fontSize: 12 },

  // Done
  mapContainerDone: { height: 220, marginHorizontal: 20, borderRadius: Radius.xl, overflow: "hidden", marginBottom: 16 },
  mapDone: { ...StyleSheet.absoluteFillObject },
  routeMarker: { alignItems: "center", justifyContent: "center" },
  doneContent: { paddingHorizontal: 28, alignItems: "center" },
  doneTitle: { color: C.text, fontSize: 24, fontWeight: "800", marginBottom: 16 },
  doneStats: { flexDirection: "row", gap: 10, width: "100%", marginBottom: 12 },
  doneStat: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 14, alignItems: "center",
  },
  doneVal: { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 2 },
  doneLbl: { color: C.textSecondary, fontSize: 10 },
  donePace: { color: C.textSecondary, fontSize: 14, marginBottom: 24 },
  againBtn: {
    backgroundColor: Palette.streakGreen, borderRadius: Radius.lg,
    paddingVertical: 15, width: "100%", alignItems: "center", marginBottom: 10,
  },
  againBtnText: { color: Palette.questNight, fontSize: 16, fontWeight: "700" },
  homeBtn: {
    borderWidth: 1, borderColor: C.border, borderRadius: Radius.lg,
    paddingVertical: 13, width: "100%", alignItems: "center",
  },
  homeBtnText: { color: C.textSecondary, fontSize: 14 },
});
