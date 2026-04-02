import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";
import { supabase } from "../lib/supabase";

const C = Colors.dark;

export default function SignupScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // mode=login olarak gelirse direkt login ekranı aç
  useEffect(() => {
    if (params.mode === "login") setIsLogin(true);
  }, []);

  const handleAuth = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(error.message);
      else router.replace("/dashboard");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else router.replace("/setup");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />

      {/* ── Top ── */}
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>🐾</Text>
        <Text style={styles.title}>
          {isLogin ? "Welcome back!" : "Create your account"}
        </Text>
        <Text style={styles.subtitle}>
          {isLogin
            ? "Sign in to continue training"
            : "Start your dog training journey"}
        </Text>
      </View>

      {/* ── Form ── */}
      <View style={styles.form}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor={C.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          placeholder="Min. 6 characters"
          placeholderTextColor={C.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Palette.questNight} />
          ) : (
            <Text style={styles.btnText}>
              {isLogin ? "Sign in →" : "Create account →"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => {
            setIsLogin(!isLogin);
            setError("");
          }}
        >
          <Text style={styles.switchText}>
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 28 },
  top: { paddingTop: 60, marginBottom: 40 },
  backText: { color: C.textSecondary, fontSize: 14, marginBottom: 32 },
  logo: { fontSize: 48, marginBottom: 16 },
  title: { color: C.text, fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: C.textSecondary, fontSize: 15 },
  form: { flex: 1 },
  label: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    padding: 14,
    color: C.text,
    fontSize: 15,
    marginBottom: Spacing.xl,
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  btnPrimary: {
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { backgroundColor: C.surface },
  btnText: { color: Palette.questNight, fontSize: 16, fontWeight: "700" },
  switchBtn: { marginTop: 20, alignItems: "center" },
  switchText: { color: C.textSecondary, fontSize: 14 },
});
