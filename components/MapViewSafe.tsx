import React, { forwardRef, useImperativeHandle } from "react";
import { Platform, StyleSheet, Text, View, type ViewProps } from "react-native";
import RealMapView, {
  Marker as RealMarker,
  Polyline as RealPolyline,
  type MapViewProps,
} from "react-native-maps";
import { Colors, Radius } from "../constants/theme";

const C = Colors.dark;

// Android requires a Google Maps API key in app.json (android.config.googleMaps.apiKey).
// Until that's set up, MapView crashes the app on mount. Render a placeholder instead.
//
// Flip ANDROID_MAPS_AVAILABLE to true once the API key is configured and the next
// EAS build picks it up.
const ANDROID_MAPS_AVAILABLE = false;
const MAPS_AVAILABLE = Platform.OS === "ios" || (Platform.OS === "android" && ANDROID_MAPS_AVAILABLE);

// Forward the ref so existing call sites like mapRef.current?.animateToRegion(...)
// don't crash on Android — we expose a noop animateToRegion via useImperativeHandle.
export const MapView = forwardRef<any, MapViewProps & ViewProps>(function MapView(
  props,
  ref,
) {
  // Always call hooks unconditionally; the placeholder branch uses the imperative handle.
  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: () => {},
      animateCamera: () => {},
      fitToCoordinates: () => {},
    }),
    [],
  );

  if (!MAPS_AVAILABLE) {
    return (
      <View style={[props.style, styles.placeholder]}>
        <Text style={styles.emoji}>🗺️</Text>
        <Text style={styles.title}>Map preview</Text>
        <Text style={styles.sub}>GPS tracking still active</Text>
      </View>
    );
  }

  // On a platform where maps work, hand the ref straight through to the real component.
  return <RealMapView ref={ref as any} {...props} />;
});

export function Polyline(props: React.ComponentProps<typeof RealPolyline>) {
  if (!MAPS_AVAILABLE) return null;
  return <RealPolyline {...props} />;
}

export function Marker(props: React.ComponentProps<typeof RealMarker>) {
  if (!MAPS_AVAILABLE) return null;
  return <RealMarker {...props} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emoji: { fontSize: 36, marginBottom: 6 },
  title: { color: C.text, fontSize: 14, fontWeight: "700" },
  sub: { color: C.textMuted, fontSize: 12, marginTop: 2 },
});
