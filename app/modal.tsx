import { router } from "expo-router";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius } from "../constants/theme";

const C = Colors.dark;

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.emoji}>🐾</Text>
      <Text style={styles.title}>PawQuest</Text>
      <Text style={styles.subtitle}>
        Something went wrong.{"\n"}Let's head back.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace("/dashboard" as any)}
      >
        <Text style={styles.btnText}>Go to dashboard →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emoji: { fontSize: 52, marginBottom: 16 },
  title: { color: C.text, fontSize: 26, fontWeight: "700", marginBottom: 8 },
  subtitle: {
    color: C.textSecondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  btn: {
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  btnText: { color: Palette.questNight, fontSize: 15, fontWeight: "700" },
});
