import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { supabase } from "../lib/supabase";

const C = Colors.dark;

interface WalkData {
  id: string;
  duration_seconds: number;
  distance_meters: number;
  xp_earned: number;
  route: { lat: number; lng: number }[];
  started_at: string;
  completed_at: string;
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

function formatSpeed(meters: number, sec: number): string {
  if (sec <= 0) return "0.0";
  return ((meters / 1000) / (sec / 3600)).toFixed(1);
}

export default function WalkDetailScreen() {
  const params = useLocalSearchParams();
  const walkId = params.id as string;
  const [walk, setWalk] = useState<WalkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWalk();
  }, [walkId]);

  const loadWalk = async () => {
    try {
      const { data, error } = await supabase
        .from("walks")
        .select("*")
        .eq("id", walkId)
        .single();
      if (error) throw error;
      setWalk(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Palette.pawGold} />
      </View>
    );
  }

  if (!walk) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={{ color: C.text }}>Walk not found</Text>
      </View>
    );
  }

  const routeCoords = (walk.route ?? []).map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  // Calculate map region to fit entire route
  let mapRegion = {
    latitude: 51.5074,
    longitude: -0.1278,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  if (routeCoords.length > 0) {
    const lats = routeCoords.map((c) => c.latitude);
    const lngs = routeCoords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const deltaLat = Math.max((maxLat - minLat) * 1.4, 0.005);
    const deltaLng = Math.max((maxLng - minLng) * 1.4, 0.005);
    mapRegion = {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: deltaLat,
      longitudeDelta: deltaLng,
    };
  }

  const startDate = new Date(walk.started_at);
  const endDate = new Date(walk.completed_at);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Walk Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map */}
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
            showsUserLocation={false}
            userInterfaceStyle="dark"
            scrollEnabled={true}
            zoomEnabled={true}
          >
            {routeCoords.length >= 2 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor={Palette.pawGold}
                strokeWidth={4}
              />
            )}
            {routeCoords.length > 0 && (
              <Marker coordinate={routeCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.marker}><Text style={{ fontSize: 14 }}>🟢</Text></View>
              </Marker>
            )}
            {routeCoords.length > 1 && (
              <Marker coordinate={routeCoords[routeCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.marker}><Text style={{ fontSize: 14 }}>🏁</Text></View>
              </Marker>
            )}
          </MapView>
          {routeCoords.length === 0 && (
            <View style={styles.noRouteOverlay}>
              <Text style={styles.noRouteText}>No route data</Text>
            </View>
          )}
        </View>

        {/* Main stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📏</Text>
            <Text style={styles.statValue}>{formatDistance(walk.distance_meters)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⏱️</Text>
            <Text style={styles.statValue}>{formatDuration(walk.duration_seconds)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={[styles.statCard, { borderColor: "rgba(250,199,117,0.25)" }]}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={[styles.statValue, { color: Palette.pawGold }]}>+{walk.xp_earned}</Text>
            <Text style={styles.statLabel}>XP Earned</Text>
          </View>
        </View>

        {/* Detailed stats */}
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Performance</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Avg Pace</Text>
            <Text style={styles.detailValue}>{formatPace(walk.distance_meters, walk.duration_seconds)}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Avg Speed</Text>
            <Text style={styles.detailValue}>{formatSpeed(walk.distance_meters, walk.duration_seconds)} km/h</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Route Points</Text>
            <Text style={styles.detailValue}>{walk.route?.length ?? 0}</Text>
          </View>
        </View>

        {/* Time info */}
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Time</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>
              {startDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Started</Text>
            <Text style={styles.detailValue}>
              {startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Finished</Text>
            <Text style={styles.detailValue}>
              {endDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loadingWrap: { flex: 1, backgroundColor: C.background, alignItems: "center", justifyContent: "center" },

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

  // Map
  mapWrap: {
    height: 280, marginHorizontal: 20, borderRadius: Radius.xl,
    overflow: "hidden", marginBottom: 16,
  },
  map: { ...StyleSheet.absoluteFillObject },
  marker: { alignItems: "center", justifyContent: "center" },
  noRouteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
  },
  noRouteText: { color: C.textMuted, fontSize: 14 },

  // Stats grid
  statsGrid: { flexDirection: "row", gap: 10, marginHorizontal: 20, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 14, alignItems: "center",
  },
  statEmoji: { fontSize: 20, marginBottom: 6 },
  statValue: { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 2 },
  statLabel: { color: C.textSecondary, fontSize: 10 },

  // Detail card
  detailCard: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: Radius.lg, padding: 16,
  },
  detailTitle: { color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  detailLabel: { color: C.textSecondary, fontSize: 14 },
  detailValue: { color: C.text, fontSize: 14, fontWeight: "600" },
  detailDivider: { height: 1, backgroundColor: C.border },
});
