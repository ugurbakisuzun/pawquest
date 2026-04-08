import { Audio } from "expo-av";

// Cached Sound objects so we don't reload the asset on every tap.
let clickerSound: Audio.Sound | null = null;
let whistleSound: Audio.Sound | null = null;
let initialized = false;

async function ensureLoaded() {
  if (initialized) return;
  try {
    // Allow audio to play even when the device is on silent (iOS)
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const [clicker, whistle] = await Promise.all([
      Audio.Sound.createAsync(require("../assets/sounds/clicker.wav")),
      Audio.Sound.createAsync(require("../assets/sounds/whistle.wav")),
    ]);
    clickerSound = clicker.sound;
    whistleSound = whistle.sound;
    initialized = true;
  } catch (err) {
    console.error("[sounds] load failed:", err);
  }
}

export async function playClicker(): Promise<void> {
  try {
    await ensureLoaded();
    if (clickerSound) await clickerSound.replayAsync();
  } catch (err) {
    console.error("[sounds] clicker play failed:", err);
  }
}

export async function playWhistle(): Promise<void> {
  try {
    await ensureLoaded();
    if (whistleSound) await whistleSound.replayAsync();
  } catch (err) {
    console.error("[sounds] whistle play failed:", err);
  }
}

export async function unloadSounds(): Promise<void> {
  try {
    if (clickerSound) {
      await clickerSound.unloadAsync();
      clickerSound = null;
    }
    if (whistleSound) {
      await whistleSound.unloadAsync();
      whistleSound = null;
    }
    initialized = false;
  } catch {}
}
