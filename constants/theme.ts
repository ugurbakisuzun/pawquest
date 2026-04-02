import { Platform } from "react-native";

// ─── PawQuest Core Palette ─────────────────────────────────────────────────
export const Palette = {
  // Brand
  questNight: "#0F0B2E", // Primary dark bg
  pawGold: "#FAC775", // XP, rewards, accents
  pawGoldDark: "#BA7517", // Gold on light bg
  levelPurple: "#7F77DD", // Levels, progress
  purpleDark: "#534AB7", // Purple on light bg
  streakGreen: "#1D9E75", // Success, streaks
  greenDark: "#0F6E56", // Green on light bg
  alertCoral: "#D85A30", // Errors, missed sessions
  boneWhite: "#F1EFE8", // Light surfaces

  // Neutrals
  white: "#FFFFFF",
  black: "#000000",
  gray100: "#D3D1C7",
  gray400: "#888780",
  gray600: "#5F5E5A",

  // Tinted backgrounds (for cards, badges)
  bgPurple: "#EEEDFE",
  bgGreen: "#E1F5EE",
  bgAmber: "#FAEEDA",
  bgCoral: "#FAECE7",
};

// ─── Semantic Colours ──────────────────────────────────────────────────────
// Import these in your components — never use Palette directly
export const Colors = {
  dark: {
    // Backgrounds
    background: Palette.questNight,
    surface: "#1A1640", // Cards on dark bg
    surfaceElevated: "#231E55", // Modals, sheets

    // Text
    text: Palette.white,
    textSecondary: "rgba(255,255,255,0.6)",
    textMuted: "rgba(255,255,255,0.35)",

    // Brand accents
    accent: Palette.pawGold,
    accentSecondary: Palette.levelPurple,
    success: Palette.streakGreen,
    error: Palette.alertCoral,

    // XP / Gamification
    xp: Palette.pawGold,
    streak: Palette.streakGreen,
    level: Palette.levelPurple,

    // UI
    border: "rgba(255,255,255,0.12)",
    borderStrong: "rgba(255,255,255,0.25)",
    tint: Palette.pawGold,
    icon: "rgba(255,255,255,0.6)",
    tabIconDefault: "rgba(255,255,255,0.4)",
    tabIconSelected: Palette.pawGold,
  },

  light: {
    // Backgrounds
    background: Palette.boneWhite,
    surface: Palette.white,
    surfaceElevated: Palette.white,

    // Text
    text: Palette.questNight,
    textSecondary: Palette.gray600,
    textMuted: Palette.gray400,

    // Brand accents
    accent: Palette.purpleDark,
    accentSecondary: Palette.pawGoldDark,
    success: Palette.greenDark,
    error: Palette.alertCoral,

    // XP / Gamification
    xp: Palette.pawGoldDark,
    streak: Palette.greenDark,
    level: Palette.purpleDark,

    // UI
    border: "rgba(15,11,46,0.12)",
    borderStrong: "rgba(15,11,46,0.25)",
    tint: Palette.purpleDark,
    icon: Palette.gray600,
    tabIconDefault: Palette.gray400,
    tabIconSelected: Palette.purpleDark,
  },
};

// ─── Typography ────────────────────────────────────────────────────────────
export const Typography = {
  // Font families (Syne & DM Sans loaded via expo-google-fonts)
  // Until fonts are loaded, falls back to system fonts below
  fontDisplay: "Syne_700Bold",
  fontHeading: "Syne_500Medium",
  fontBody: "DMSans_400Regular",
  fontLabel: "DMSans_500Medium",
  fontMono: "DMSans_400Regular",

  // System fallbacks (used before custom fonts load)
  ...Platform.select({
    ios: { fontFallback: "System" },
    android: { fontFallback: "Roboto" },
    default: { fontFallback: "System" },
  }),

  // Scale
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    "2xl": 28,
    "3xl": 34,
    "4xl": 42,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.75,
  },
};

// ─── Spacing ───────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
};

// ─── Border Radius ─────────────────────────────────────────────────────────
export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

// ─── Shadows ───────────────────────────────────────────────────────────────
export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    // Gold glow for XP/reward moments
    shadowColor: Palette.pawGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ─── XP Config ─────────────────────────────────────────────────────────────
export const XP = {
  stepComplete: 10, // XP per completed training step
  sessionComplete: 50, // Bonus for finishing full session
  streakBonus: 25, // Extra XP when streak continues
  firstSession: 100, // Welcome bonus
  weekComplete: 200, // Finished all 7 days in a week

  // Level thresholds
  levels: [
    { level: 1, minXP: 0, title: "Curious Pup" },
    { level: 2, minXP: 200, title: "Learning Tail" },
    { level: 3, minXP: 500, title: "Good Boy/Girl" },
    { level: 4, minXP: 1000, title: "Focused Paw" },
    { level: 5, minXP: 2000, title: "Training Pro" },
    { level: 6, minXP: 3500, title: "Alpha Quester" },
  ],
};
