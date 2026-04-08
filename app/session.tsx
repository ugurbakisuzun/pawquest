import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Palette, Radius, Spacing } from "../constants/theme";
import { sendSessionCompleteNotification } from "../lib/notifications";
import { SoundPanel } from "../components/SoundPanel";
import { computeLevel, useStore } from "../lib/store";
import { supabase } from "../lib/supabase";

const C = Colors.dark;

let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = () => {};
try {
  const mod = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {}

interface ProgramStep {
  number: number;
  instruction: string;
  duration_seconds: number;
  break_seconds: number;
  voice_prompt: string | null;
}

interface ProgramDay {
  day: number;
  title: string;
  goal: string;
  steps: ProgramStep[];
}

interface StepAnalysis {
  stepIndex: number;
  transcript: string;
  feedback: string;
}


export default function SessionScreen() {
  const params = useLocalSearchParams();
  const dayNumber = Number(params.day) || 1;
  const programSlug = (params.slug as string) || "separation-anxiety";
  const programTitle = params.programTitle ? decodeURIComponent(params.programTitle as string) : "Training";
  const trickName = params.trickName as string | undefined;
  const trickDesc = params.trickDesc as string | undefined;
  const trickXp = Number(params.trickXp) || 80;
  const trickId = params.trickId as string | undefined;
  const trickSteps: string[] | undefined = params.trickSteps
    ? JSON.parse(params.trickSteps as string)
    : undefined;

  const { dog, setDog, syncCompletedTrick, checkAndAwardBadges, loadBadges, completeDailyMission, dailyMissions, completedDailyIds } = useStore();
  const [dayData, setDayData] = useState<ProgramDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [activePromptIndex, setActivePromptIndex] = useState<number | null>(
    null,
  );
  const [isListening, setIsListening] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analyses, setAnalyses] = useState<StepAnalysis[]>([]);
  const [textInput, setTextInput] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  // ── Step countdown timer ──
  type StepTimer = {
    stepIndex: number;
    phase: "training" | "break" | "done";
    remaining: number;
    paused: boolean;
  };
  const [stepTimer, setStepTimer] = useState<StepTimer | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTrickMode = !!trickName;
  const hasNativeSpeech = !!ExpoSpeechRecognitionModule;

  useSpeechRecognitionEvent("result", (event: any) => {
    const text = event.results[0]?.transcript ?? "";
    if (text && activePromptIndex !== null) {
      setIsListening(false);
      analyseWithAI(text, activePromptIndex);
    }
  });
  useSpeechRecognitionEvent("error", () => setIsListening(false));
  useSpeechRecognitionEvent("end", () => setIsListening(false));

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
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

  // ── Step timer ──

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const tickTimer = () => {
    setStepTimer((t) => {
      if (!t || t.paused || t.phase === "done") return t;
      if (t.remaining > 1) return { ...t, remaining: t.remaining - 1 };

      // remaining is about to hit 0 → transition
      const step = dayData?.steps[t.stepIndex];
      if (t.phase === "training" && step && step.break_seconds > 0) {
        return { ...t, phase: "break", remaining: step.break_seconds };
      }

      // Done — clear interval and auto-complete the step
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Defer to next tick so we don't update other state inside this setter
      setTimeout(() => {
        setCompletedSteps((current) => {
          if (current.includes(t.stepIndex)) return current;
          // Trigger voice prompt UI if applicable (mirror toggleStep behaviour)
          if (step?.voice_prompt) {
            setActivePromptIndex(t.stepIndex);
            setTextInput("");
          }
          return [...current, t.stepIndex];
        });
      }, 0);
      return { ...t, phase: "done", remaining: 0 };
    });
  };

  const startInterval = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(tickTimer, 1000);
  };

  const startStepTimer = (stepIndex: number) => {
    const step = dayData?.steps[stepIndex];
    if (!step || !step.duration_seconds) return;
    setStepTimer({
      stepIndex,
      phase: "training",
      remaining: step.duration_seconds,
      paused: false,
    });
    startInterval();
  };

  const togglePauseTimer = () => {
    setStepTimer((t) => {
      if (!t || t.phase === "done") return t;
      const nextPaused = !t.paused;
      if (nextPaused) {
        // Pausing — kill interval
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      } else {
        // Resuming — restart interval
        startInterval();
      }
      return { ...t, paused: nextPaused };
    });
  };

  const resetStepTimer = () => {
    setStepTimer((t) => {
      if (!t) return t;
      const step = dayData?.steps[t.stepIndex];
      if (!step) return t;
      // Restart from training phase
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(tickTimer, 1000);
      return {
        stepIndex: t.stepIndex,
        phase: "training",
        remaining: step.duration_seconds,
        paused: false,
      };
    });
  };

  const stopStepTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setStepTimer(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (isTrickMode) {
      setDayData({
        day: 0,
        title: trickName!,
        goal: trickDesc || "",
        steps: (trickSteps || []).map((instruction, i) => ({
          number: i + 1,
          instruction,
          duration_seconds: 0,
          break_seconds: 60,
          voice_prompt:
            i === (trickSteps?.length ?? 1) - 1
              ? "How did the session go? What did your dog do best?"
              : null,
        })),
      });
      setLoading(false);
      return;
    }
    loadDay();
  }, []);

  const loadDay = async () => {
    try {
      const { data, error } = await supabase
        .from("training_programs")
        .select("content")
        .eq("slug", programSlug)
        .single();
      if (error) throw error;
      const days: ProgramDay[] = data.content;
      const found = days.find((d) => d.day === dayNumber);
      const sorted = [...days].sort(
        (a, b) => Math.abs(a.day - dayNumber) - Math.abs(b.day - dayNumber),
      );
      setDayData(found ?? sorted[0] ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startListening = async (stepIndex: number) => {
    if (!hasNativeSpeech) return;
    try {
      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        alert("Microphone permission required.");
        return;
      }
      setActivePromptIndex(stepIndex);
      setIsListening(true);
      setTextInput("");
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

  const analyseWithAI = async (transcript: string, stepIndex: number) => {
    if (!dayData || !transcript.trim()) return;
    setIsAnalysing(true);
    const step = dayData.steps[stepIndex];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const { data, error } = await supabase.functions.invoke("claude-chat", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 150,
          system: `You are Pawlo — the friendly dog teacher mascot at the heart of the Pawlo app. You're warm, encouraging, and a little playful, like the most patient dog trainer the user has ever met.
Dog: ${dog?.name ?? "the dog"}, ${dog?.breed ?? "unknown breed"}, Level ${dog?.level ?? 1}.
Program: ${programTitle} · Day ${dayData.day} — ${dayData.title}.
Step ${step.number}: ${step.instruction}
Question: ${step.voice_prompt}
Analyse in 2 short sentences: what the behaviour indicates, and one actionable tip. Be warm and jargon-free. Use the dog's name.`,
          messages: [{ role: "user", content: transcript }],
        },
      });
      if (error) {
        console.error("[claude-chat] invoke error:", error);
        throw error;
      }
      const feedback =
        data?.content?.[0]?.text ?? "Great observation — keep going!";
      setAnalyses((prev) => [
        ...prev.filter((a) => a.stepIndex !== stepIndex),
        { stepIndex, transcript, feedback },
      ]);
      setTextInput("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      setAnalyses((prev) => [
        ...prev.filter((a) => a.stepIndex !== stepIndex),
        {
          stepIndex,
          transcript,
          feedback: "Couldn't analyse right now — great job observing!",
        },
      ]);
    } finally {
      setIsAnalysing(false);
      setActivePromptIndex(null);
    }
  };

  const toggleStep = (index: number) => {
    const isCompleting = !completedSteps.includes(index);
    setCompletedSteps((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
    if (isCompleting && dayData?.steps[index]?.voice_prompt) {
      setTimeout(() => {
        setActivePromptIndex(index);
        setTextInput("");
      }, 300);
    } else {
      setActivePromptIndex(null);
    }
  };

  const handleDone = async () => {
    if (!dog || saving) return;
    setSaving(true);
    try {
      // Cache initial level so we can detect level-up after ALL XP additions
      // (session XP + daily mission XP + badge XP) are applied.
      const initialLevel = dog.level;

      const xpEarned = isTrickMode
        ? trickXp
        : Math.round(50 + (dayData?.steps.length ?? 5) * 10);
      const newXP = dog.total_xp + xpEarned;
      const newLevel = computeLevel(newXP);
      const now = new Date();

      const lastTrained = dog.last_trained_at
        ? new Date(dog.last_trained_at)
        : null;
      const diffHours = lastTrained
        ? (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60)
        : 999;

      let newStreak: number;
      if (!lastTrained) newStreak = 1;
      else if (diffHours < 24) newStreak = Math.max(dog.streak_days, 1);
      else if (diffHours < 48) newStreak = dog.streak_days + 1;
      else newStreak = 1;

      const { data, error } = await supabase
        .from("dogs")
        .update({
          total_xp: newXP,
          level: newLevel,
          streak_days: newStreak,
          last_trained_at: now.toISOString(),
        })
        .eq("id", dog.id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from("xp_events").insert({
        dog_id: dog.id,
        amount: xpEarned,
        reason: isTrickMode ? `${trickName} trick` : `${programTitle} Day ${dayNumber}`,
      });

      if (!isTrickMode) {
        await supabase.from("training_sessions").insert({
          dog_id: dog.id,
          day_number: dayNumber,
          program_slug: programSlug,
        });
      }

      setDog(data);

      if (isTrickMode && trickId) {
        await syncCompletedTrick(dog.id, trickId);
      }

      // Auto-complete daily missions
      for (const m of dailyMissions) {
        if (completedDailyIds.includes(m.id)) continue;
        if (m.type === "sa_session" && !isTrickMode) {
          await completeDailyMission(dog.id, m.id);
        }
        if (m.type === "trick" && isTrickMode) {
          await completeDailyMission(dog.id, m.id);
        }
      }

      // Check and award badges
      await loadBadges(dog.id);
      const newBadges = await checkAndAwardBadges(dog.id);

      await sendSessionCompleteNotification(dog.name, xpEarned, newStreak);

      // Read FINAL dog state after all XP additions (session + missions + badges)
      // and decide level-up based on that final level vs the initial level we
      // cached at the top of handleDone.
      const finalDog = useStore.getState().dog;
      const finalLevel = finalDog?.level ?? newLevel;
      const finalXP = finalDog?.total_xp ?? newXP;
      const leveledUp = finalLevel > initialLevel;

      if (newBadges.length > 0) {
        // Navigate with badge info — replace so session is removed from stack
        const badgeNames = newBadges.map((b) => `${b.emoji} ${b.name}`).join(", ");
        const badgeXP = newBadges.reduce((s, b) => s + b.xp_reward, 0);
        router.replace(
          leveledUp
            ? (`/levelup?level=${finalLevel}&xp=${finalXP}&name=${dog.name}&badges=${encodeURIComponent(badgeNames)}&badgeXP=${badgeXP}` as any)
            : (`/dashboard?newBadges=${encodeURIComponent(badgeNames)}&badgeXP=${badgeXP}` as any),
        );
      } else {
        router.replace(
          leveledUp
            ? (`/levelup?level=${finalLevel}&xp=${finalXP}&name=${dog.name}` as any)
            : ("/dashboard" as any),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.pawGold} />
      </View>
    );

  if (!dayData)
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: C.text }}>Session not found.</Text>
      </View>
    );

  const totalSteps = dayData.steps.length;
  const progress = totalSteps > 0 ? completedSteps.length / totalSteps : 0;
  const xpEarned = isTrickMode ? trickXp : Math.round(50 + totalSteps * 10);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.progressBarWrap}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progress * 100}%` as any },
              ]}
            />
          </View>
          <Text style={styles.stepCount}>
            {completedSteps.length}/{totalSteps}
          </Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{isTrickMode ? "🐕" : "🐾"}</Text>
          <Text style={styles.heroTitle}>{dayData.title}</Text>
          {!isTrickMode && (
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>Day {dayData.day}</Text>
            </View>
          )}
          <Text style={styles.heroGoal}>{dayData.goal}</Text>
        </View>

        <View style={styles.xpBadge}>
          <Text style={styles.xpBadgeText}>
            ⭐ Complete to earn +{xpEarned} XP
          </Text>
        </View>

        <Text style={styles.stepsTitle}>Step by step</Text>
        {dayData.steps.map((step, index) => {
          const done = completedSteps.includes(index);
          const analysis = analyses.find((a) => a.stepIndex === index);
          const isActive = activePromptIndex === index;

          return (
            <View key={index}>
              <TouchableOpacity
                style={[styles.stepItem, done && styles.stepDone]}
                onPress={() => toggleStep(index)}
              >
                <View style={[styles.stepNum, done && styles.stepNumDone]}>
                  <Text
                    style={[styles.stepNumText, done && styles.stepNumTextDone]}
                  >
                    {done ? "✓" : step.number}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepText, done && styles.stepTextDone]}>
                    {step.instruction}
                  </Text>
                  {step.duration_seconds > 0 && stepTimer?.stepIndex !== index && (
                    <View style={styles.stepTimerRow}>
                      <Text style={styles.stepMeta}>
                        ⏱ {step.duration_seconds}s
                        {step.break_seconds > 0
                          ? `  ·  🔄 ${step.break_seconds}s break`
                          : ""}
                      </Text>
                      {!done && (
                        <TouchableOpacity
                          style={styles.startTimerBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            startStepTimer(index);
                          }}
                        >
                          <Text style={styles.startTimerBtnText}>▶ Start</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Active timer for this step */}
                  {stepTimer?.stepIndex === index && (
                    <View
                      style={[
                        styles.timerCard,
                        stepTimer.phase === "break" && styles.timerCardBreak,
                        stepTimer.phase === "done" && styles.timerCardDone,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timerPhaseLabel,
                          stepTimer.phase === "break" && { color: Palette.streakGreen },
                          stepTimer.phase === "done" && { color: Palette.pawGold },
                        ]}
                      >
                        {stepTimer.phase === "training"
                          ? "TRAINING"
                          : stepTimer.phase === "break"
                            ? "BREAK"
                            : "DONE"}
                      </Text>
                      <Text style={styles.timerCountdown}>
                        {formatTime(stepTimer.remaining)}
                      </Text>
                      {stepTimer.phase !== "done" && (
                        <View style={styles.timerControls}>
                          <TouchableOpacity
                            style={styles.timerBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              togglePauseTimer();
                            }}
                          >
                            <Text style={styles.timerBtnText}>
                              {stepTimer.paused ? "▶ Resume" : "⏸ Pause"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.timerBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              resetStepTimer();
                            }}
                          >
                            <Text style={styles.timerBtnText}>↻ Reset</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.timerBtn, styles.timerBtnGhost]}
                            onPress={(e) => {
                              e.stopPropagation();
                              stopStepTimer();
                            }}
                          >
                            <Text style={styles.timerBtnGhostText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {step.voice_prompt && !done && (
                    <Text style={styles.stepPromptHint}>
                      🎙️ Pawlo will ask after this step
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {isActive && step.voice_prompt && (
                <View style={styles.voiceCard}>
                  <Text style={styles.voiceQuestion}>{step.voice_prompt}</Text>
                  {hasNativeSpeech ? (
                    <TouchableOpacity
                      style={[
                        styles.micBtn,
                        isListening && styles.micBtnActive,
                      ]}
                      onPress={
                        isListening
                          ? stopListening
                          : () => startListening(index)
                      }
                    >
                      <Animated.View
                        style={{ transform: [{ scale: pulseAnim }] }}
                      >
                        <Text style={styles.micIcon}>
                          {isListening ? "⏹" : "🎤"}
                        </Text>
                      </Animated.View>
                      <Text style={styles.micLabel}>
                        {isListening ? "Tap to stop" : "Tap to record"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.textInputWrap}>
                      <TextInput
                        style={styles.observationInput}
                        placeholder="Describe what your dog did…"
                        placeholderTextColor={C.textMuted}
                        value={textInput}
                        onChangeText={setTextInput}
                        multiline
                        maxLength={300}
                      />
                      <TouchableOpacity
                        style={[
                          styles.sendObsBtn,
                          (!textInput.trim() || isAnalysing) &&
                            styles.sendObsBtnDisabled,
                        ]}
                        onPress={() => analyseWithAI(textInput, index)}
                        disabled={!textInput.trim() || isAnalysing}
                      >
                        <Text
                          style={[
                            styles.sendObsText,
                            (!textInput.trim() || isAnalysing) &&
                              styles.sendObsTextDisabled,
                          ]}
                        >
                          {isAnalysing ? "Analysing…" : "Get AI feedback →"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {isAnalysing && (
                    <View style={styles.analysingRow}>
                      <ActivityIndicator
                        size="small"
                        color={Palette.levelPurple}
                      />
                      <Text style={styles.analysingText}>
                        Pawlo is thinking…
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.skipPromptBtn}
                    onPress={() => setActivePromptIndex(null)}
                  >
                    <Text style={styles.skipPromptText}>Skip for now</Text>
                  </TouchableOpacity>
                </View>
              )}

              {analysis && (
                <View style={styles.feedbackCard}>
                  <View style={styles.feedbackHeader}>
                    <Text style={styles.feedbackIcon}>🤖</Text>
                    <Text style={styles.feedbackTitle}>Pawlo says</Text>
                  </View>
                  <Text style={styles.feedbackTranscript}>
                    "{analysis.transcript}"
                  </Text>
                  <Text style={styles.feedbackText}>{analysis.feedback}</Text>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.btnSuccess,
              (completedSteps.length < totalSteps || saving) &&
                styles.btnDisabled,
            ]}
            onPress={handleDone}
            disabled={completedSteps.length < totalSteps || saving}
          >
            {saving ? (
              <ActivityIndicator color={Palette.questNight} />
            ) : (
              <Text style={styles.btnSuccessText}>
                {completedSteps.length === totalSteps
                  ? `🎉 Complete session! +${xpEarned} XP`
                  : `Complete all ${totalSteps} steps to finish`}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSkip}
            onPress={() => router.back()}
          >
            <Text style={styles.btnSkipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.aiTip}
          onPress={() => router.push("/advisor" as any)}
        >
          <Text style={styles.aiTipIcon}>🤖</Text>
          <Text style={styles.aiTipText}>
            More questions? Ask the AI Advisor →
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating clicker + whistle for hands-free training */}
      <SoundPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  backText: { color: C.textSecondary, fontSize: 14 },
  progressBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: C.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Palette.pawGold,
    borderRadius: 3,
  },
  stepCount: { color: C.textSecondary, fontSize: 12 },

  hero: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: "center",
    marginBottom: 12,
  },
  heroEmoji: { fontSize: 56, marginBottom: 12 },
  heroTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  dayBadge: {
    backgroundColor: "rgba(250,199,117,0.15)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.3)",
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  dayBadgeText: { color: C.xp, fontSize: 12, fontWeight: "600" },
  heroGoal: {
    color: C.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  xpBadge: {
    backgroundColor: "rgba(250,199,117,0.1)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.2)",
    borderRadius: Radius.md,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  xpBadgeText: { color: C.xp, fontSize: 13, fontWeight: "600" },

  stepsTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
  },
  stepDone: {
    backgroundColor: "rgba(29,158,117,0.06)",
    borderColor: "rgba(29,158,117,0.2)",
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(250,199,117,0.15)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.3)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumDone: {
    backgroundColor: "rgba(29,158,117,0.15)",
    borderColor: "rgba(29,158,117,0.3)",
  },
  stepNumText: { color: C.xp, fontSize: 12, fontWeight: "700" },
  stepNumTextDone: { color: C.success },
  stepText: { color: C.text, fontSize: 14, lineHeight: 22 },
  stepTextDone: { color: C.textSecondary },
  stepMeta: { color: C.textMuted, fontSize: 11, marginTop: 4 },
  stepPromptHint: { color: Palette.levelPurple, fontSize: 11, marginTop: 4 },
  stepTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  startTimerBtn: {
    backgroundColor: "rgba(250,199,117,0.18)",
    borderWidth: 1,
    borderColor: Palette.pawGold,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  startTimerBtnText: {
    color: Palette.pawGold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  timerCard: {
    marginTop: 12,
    backgroundColor: "rgba(250,199,117,0.1)",
    borderWidth: 1,
    borderColor: Palette.pawGold,
    borderRadius: Radius.lg,
    padding: 16,
    alignItems: "center",
  },
  timerCardBreak: {
    backgroundColor: "rgba(29,158,117,0.1)",
    borderColor: Palette.streakGreen,
  },
  timerCardDone: {
    backgroundColor: "rgba(127,119,221,0.08)",
    borderColor: Palette.levelPurple,
  },
  timerPhaseLabel: {
    color: Palette.pawGold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  timerCountdown: {
    color: C.text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    marginBottom: 12,
  },
  timerControls: {
    flexDirection: "row",
    gap: 8,
  },
  timerBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  timerBtnText: { color: C.text, fontSize: 12, fontWeight: "700" },
  timerBtnGhost: {
    paddingHorizontal: 12,
  },
  timerBtnGhostText: { color: C.textSecondary, fontSize: 14, fontWeight: "700" },

  voiceCard: {
    backgroundColor: "rgba(127,119,221,0.1)",
    borderWidth: 1,
    borderColor: "rgba(127,119,221,0.25)",
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 8,
    alignItems: "center",
  },
  voiceQuestion: {
    color: C.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  micBtn: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  micBtnActive: {
    backgroundColor: "rgba(250,199,117,0.15)",
    borderColor: Palette.pawGold,
  },
  micIcon: { fontSize: 28 },
  micLabel: { color: C.textSecondary, fontSize: 12 },

  textInputWrap: { width: "100%", gap: 8, marginBottom: 8 },
  observationInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    padding: 12,
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: "top",
    width: "100%",
  },
  sendObsBtn: {
    backgroundColor: Palette.pawGold,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  sendObsBtnDisabled: {
    backgroundColor: "rgba(250,199,117,0.15)",
    borderWidth: 1,
    borderColor: "rgba(250,199,117,0.3)",
  },
  sendObsText: { color: Palette.questNight, fontSize: 13, fontWeight: "600" },
  sendObsTextDisabled: { color: "rgba(250,199,117,0.5)" },

  analysingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  analysingText: { color: Palette.levelPurple, fontSize: 12 },
  skipPromptBtn: { paddingVertical: 6 },
  skipPromptText: { color: C.textMuted, fontSize: 12 },

  feedbackCard: {
    backgroundColor: "rgba(29,158,117,0.08)",
    borderWidth: 1,
    borderColor: "rgba(29,158,117,0.2)",
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  feedbackIcon: { fontSize: 16 },
  feedbackTitle: { color: C.success, fontSize: 13, fontWeight: "600" },
  feedbackTranscript: {
    color: C.textSecondary,
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 18,
  },
  feedbackText: { color: C.text, fontSize: 13, lineHeight: 20 },

  actions: { gap: 10, marginTop: 8 },
  btnSuccess: {
    backgroundColor: Palette.streakGreen,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnDisabled: { backgroundColor: C.surface },
  btnSuccessText: {
    color: Palette.questNight,
    fontSize: 15,
    fontWeight: "700",
  },
  btnSkip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnSkipText: { color: C.textSecondary, fontSize: 15 },
  aiTip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    padding: 12,
  },
  aiTipIcon: { fontSize: 16 },
  aiTipText: { color: C.accent, fontSize: 13 },
});
