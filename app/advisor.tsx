import { router } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius } from "../constants/theme";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.dark;

let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = () => {};
try {
  const mod = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Why won't my dog come when called?",
  "Best tricks for my breed?",
  "My dog pulls on the leash 😤",
];

const FREE_DAILY_MESSAGES = 5;

export default function AdvisorScreen() {
  const { dog, isPro } = useStore();
  const [todayCount, setTodayCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hey! I'm Pawlo, your dog's personal teacher 🐾 I know ${dog?.name ?? "your dog"} is a ${dog?.age ?? ""} old ${dog?.breed ?? "dog"} at Level ${dog?.level ?? 1}. Ask me anything about training — or tap the mic to speak!`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useSpeechRecognitionEvent("result", (event: any) => {
    const text = event.results[0]?.transcript ?? "";
    if (text) {
      setInput(text);
      setIsListening(false);
      sendMessage(text);
    }
  });
  useSpeechRecognitionEvent("error", () => setIsListening(false));
  useSpeechRecognitionEvent("end", () => setIsListening(false));

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Load today's message count for free-tier limit
  useEffect(() => {
    if (!dog) return;
    (async () => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("advisor_message_log")
        .select("id", { count: "exact", head: true })
        .eq("dog_id", dog.id)
        .gte("sent_at", dayStart.toISOString());
      setTodayCount(count ?? 0);
    })();
  }, [dog?.id]);

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const startListening = async () => {
    if (!ExpoSpeechRecognitionModule) {
      alert(
        "Voice input requires a development build. Use the text input for now.",
      );
      return;
    }
    try {
      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        alert("Microphone permission is required.");
        return;
      }
      setIsListening(true);
      setInput("");
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        continuous: true,
        interimResults: false,
      });
    } catch {
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (ExpoSpeechRecognitionModule) ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  };

  const speakMessage = (text: string, msgId: string) => {
    if (isSpeaking && speakingMsgId === msgId) {
      Speech.stop();
      setIsSpeaking(false);
      setSpeakingMsgId(null);
      return;
    }
    Speech.stop();
    setSpeakingMsgId(msgId);
    setIsSpeaking(true);
    Speech.speak(text, {
      language: "en-US",
      rate: 0.9,
      onDone: () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
      },
      onError: () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
      },
    });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    // Free-tier daily limit gating
    if (!isPro && todayCount >= FREE_DAILY_MESSAGES) {
      router.push("/paywall" as any);
      return;
    }
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const systemPrompt = `You are Pawlo — the friendly dog teacher mascot at the heart of the Pawlo app. You're warm, encouraging, and a little playful, like the most patient dog trainer the user has ever met. Think Duolingo's Duo, but for dogs.
Dog profile: Name: ${dog?.name}, Breed: ${dog?.breed}, Age: ${dog?.age}, Level: ${dog?.level}, XP: ${dog?.total_xp}
Rules: Always call the dog by name. Max 3 short paragraphs. Give numbered actionable steps when teaching a behaviour. Be warm, encouraging, jargon-free. Cheer for streaks and wins.`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const { data, error } = await supabase.functions.invoke("claude-chat", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          system: systemPrompt,
          messages: [
            ...messages
              .filter((m) => m.id !== "welcome")
              .slice(-6)
              .map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text.trim() },
          ],
        },
      });
      if (error) {
        console.error("[claude-chat] invoke error:", error);
        throw error;
      }
      const replyText = data?.content?.[0]?.text ?? "Sorry, I couldn't respond. Try again!";
      const assistantId = (Date.now() + 1).toString();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: replyText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      speakMessage(replyText, assistantId);

      // Log this message for daily limit tracking + bump local counter
      if (dog) {
        await supabase.from("advisor_message_log").insert({ dog_id: dog.id });
        setTodayCount((c) => c + 1);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, something went wrong. Try again!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Speech.stop();
            router.back();
          }}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.aiHeader}>
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarEmoji}>🐶</Text>
          </View>
          <View>
            <Text style={styles.aiName}>Pawlo</Text>
            <Text style={styles.aiStatus}>
              {isListening
                ? "🎤 Listening..."
                : isSpeaking
                  ? "🔊 Speaking..."
                  : "● Online · Powered by Claude"}
            </Text>
          </View>
        </View>
        {!isPro && (
          <TouchableOpacity
            style={[
              styles.limitPill,
              todayCount >= FREE_DAILY_MESSAGES && styles.limitPillFull,
            ]}
            onPress={() => router.push("/paywall" as any)}
          >
            <Text
              style={[
                styles.limitPillText,
                todayCount >= FREE_DAILY_MESSAGES && styles.limitPillTextFull,
              ]}
            >
              {todayCount >= FREE_DAILY_MESSAGES
                ? "Daily limit · Tap to upgrade"
                : `${todayCount}/${FREE_DAILY_MESSAGES} today`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View key={msg.id}>
            <View
              style={[
                styles.bubble,
                msg.role === "user" ? styles.bubbleUser : styles.bubbleAI,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  msg.role === "user"
                    ? styles.bubbleTextUser
                    : styles.bubbleTextAI,
                ]}
              >
                {msg.content}
              </Text>
            </View>
            {msg.role === "assistant" && msg.id !== "welcome" && (
              <TouchableOpacity
                style={styles.speakBtn}
                onPress={() => speakMessage(msg.content, msg.id)}
              >
                <Text style={styles.speakBtnText}>
                  {isSpeaking && speakingMsgId === msg.id
                    ? "⏹ Stop"
                    : "🔊 Listen"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {isLoading && (
          <View style={[styles.bubble, styles.bubbleAI]}>
            <ActivityIndicator size="small" color={Palette.pawGold} />
          </View>
        )}

        {messages.length === 1 && !isLoading && (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.chip}
                onPress={() => sendMessage(s)}
              >
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Input Bar ── */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={
            isListening
              ? "Listening..."
              : `Ask about ${dog?.name ?? "your dog"}…`
          }
          placeholderTextColor={isListening ? Palette.pawGold : C.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          editable={!isListening}
        />
        <TouchableOpacity
          style={styles.micBtn}
          onPress={isListening ? stopListening : startListening}
        >
          <Animated.View
            style={[
              styles.micInner,
              isListening && styles.micActive,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.micIcon}>{isListening ? "⏹" : "🎤"}</Text>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || isLoading || isListening) &&
              styles.sendBtnDisabled,
          ]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || isLoading || isListening}
        >
          <Text style={styles.sendIcon}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backText: { color: C.textSecondary, fontSize: 14, marginBottom: 16 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  aiAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(83,74,183,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiAvatarEmoji: { fontSize: 22 },
  aiName: { color: C.text, fontSize: 16, fontWeight: "700" },
  aiStatus: { color: C.success, fontSize: 12, marginTop: 2 },
  limitPill: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "rgba(250,199,117,0.12)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.3)",
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  limitPillFull: {
    backgroundColor: "rgba(231,111,81,0.12)",
    borderColor: "rgba(231,111,81,0.4)",
  },
  limitPillText: { color: Palette.pawGold, fontSize: 11, fontWeight: "700" },
  limitPillTextFull: { color: "#E76F51" },
  chatArea: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  bubble: { maxWidth: "85%", padding: 14, borderRadius: 18, marginBottom: 4 },
  bubbleAI: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomLeftRadius: 4,
    alignSelf: "flex-start",
  },
  bubbleUser: {
    backgroundColor: "rgba(250,199,117,0.15)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.2)",
    borderBottomRightRadius: 4,
    alignSelf: "flex-end",
  },
  bubbleText: { fontSize: 14, lineHeight: 22 },
  bubbleTextAI: { color: C.text },
  bubbleTextUser: { color: C.text },
  speakBtn: { alignSelf: "flex-start", marginBottom: 12, marginLeft: 4 },
  speakBtnText: { color: C.textSecondary, fontSize: 12 },
  suggestions: { gap: 8, marginTop: 4 },
  chip: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignSelf: "flex-start",
  },
  chipText: { color: C.text, fontSize: 13 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.background,
  },
  input: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: C.text,
    fontSize: 14,
    maxHeight: 100,
  },
  micBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  micInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  micActive: {
    backgroundColor: "rgba(250,199,117,0.2)",
    borderColor: Palette.pawGold,
  },
  micIcon: { fontSize: 18 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.pawGold,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.surface },
  sendIcon: { color: Palette.questNight, fontSize: 18, fontWeight: "700" },
});
