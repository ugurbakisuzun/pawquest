import { create } from "zustand";

export interface Dog {
  id: string;
  name: string;
  breed: string;
  age: string;
  level: number;
  total_xp: number;
  streak_days: number;
  last_trained_at?: string;
  experience?: string;
  owner_id?: string;
}

export function getLevelInfo(xp: number): {
  level: number;
  title: string;
  nextLevelXP: number;
} {
  const levels = [
    { level: 1, minXP: 0, title: "Curious Pup" },
    { level: 2, minXP: 200, title: "Learning Tail" },
    { level: 3, minXP: 500, title: "Good Boy/Girl" },
    { level: 4, minXP: 1000, title: "Focused Paw" },
    { level: 5, minXP: 2000, title: "Training Pro" },
    { level: 6, minXP: 3500, title: "Alpha Quester" },
  ];
  const current = [...levels].reverse().find((l) => xp >= l.minXP) ?? levels[0];
  const next = levels.find((l) => l.minXP > xp);
  return {
    level: current.level,
    title: current.title,
    nextLevelXP: next?.minXP ?? 9999,
  };
}

export function getStreakStatus(
  lastTrainedAt?: string,
): "active" | "at_risk" | "broken" {
  if (!lastTrainedAt) return "broken";
  const last = new Date(lastTrainedAt);
  const now = new Date();
  const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
  if (diffHours < 24) return "active";
  if (diffHours < 48) return "at_risk";
  return "broken";
}

interface AppState {
  userId: string | null;
  dog: Dog | null;
  completedMissions: string[];
  setUserId: (id: string | null) => void;
  setDog: (dog: Dog | null) => void;
  addCompletedMission: (id: string) => void;
  removeCompletedMission: (id: string) => void;
  resetMissions: () => void;
}

export const useStore = create<AppState>((set) => ({
  userId: null,
  dog: null,
  completedMissions: [],
  setUserId: (id) => set({ userId: id }),
  setDog: (dog) => set({ dog }),
  addCompletedMission: (id) =>
    set((state) => ({
      completedMissions: state.completedMissions.includes(id)
        ? state.completedMissions
        : [...state.completedMissions, id],
    })),
  removeCompletedMission: (id) =>
    set((state) => ({
      completedMissions: state.completedMissions.filter((m) => m !== id),
    })),
  resetMissions: () => set({ completedMissions: [] }),
}));
