import { Component, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";

const C = Colors.dark;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Surfaced in Expo dev tools / native logs. Replace with a remote sink
    // (Sentry, Logtail, etc.) when one is wired up.
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🐾</Text>
        <Text style={styles.title}>Pawlo tripped over a paw</Text>
        <Text style={styles.body}>
          Something unexpected happened. Tap below to give it another go — your
          progress is safe.
        </Text>
        {__DEV__ && this.state.error?.message ? (
          <Text style={styles.devError}>{this.state.error.message}</Text>
        ) : null}
        <TouchableOpacity style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 64, marginBottom: Spacing.lg },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  devError: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center",
    marginBottom: Spacing.lg,
    fontFamily: "Courier",
  },
  button: {
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: {
    color: Palette.questNight,
    fontSize: 15,
    fontWeight: "700",
  },
});
