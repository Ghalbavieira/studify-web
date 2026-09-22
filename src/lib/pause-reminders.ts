"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";

export const reminderKinds = ["water", "stretch", "walk", "breathe", "meditate"] as const;
export type PauseReminderKind = typeof reminderKinds[number];

export const pauseReminderLabels: Record<PauseReminderKind, string> = {
  water: "Beber água",
  stretch: "Alongar",
  walk: "Caminhar 2 min",
  breathe: "Respirar por 1 min",
  meditate: "Meditar alguns minutos",
};

const preferencesSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(10).max(180),
  kinds: z.array(z.enum(reminderKinds)).min(1),
});

export type PauseReminderPreferences = z.infer<typeof preferencesSchema>;
export const defaultPauseReminderPreferences: PauseReminderPreferences = {
  enabled: false,
  intervalMinutes: 50,
  kinds: ["water", "stretch", "walk", "breathe"],
};

const eventName = "studify-pause-reminders-change";
const memory = new Map<string, PauseReminderPreferences>();
const snapshots = new Map<string, PauseReminderPreferences>();
const storageKey = (userId: string | null) => `studify.pause-reminders.${userId ?? "local"}`;

export function parsePauseReminderPreferences(value: unknown): PauseReminderPreferences {
  const parsed = preferencesSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultPauseReminderPreferences;
}

export function reminderNumber(elapsedSeconds: number, preferences: PauseReminderPreferences) {
  if (!preferences.enabled) return 0;
  return Math.floor(elapsedSeconds / (preferences.intervalMinutes * 60));
}

function read(userId: string | null) {
  const key = storageKey(userId);
  if (snapshots.has(key)) return snapshots.get(key)!;
  let value = memory.get(key) ?? defaultPauseReminderPreferences;
  try {
    const stored = localStorage.getItem(key);
    if (stored) value = parsePauseReminderPreferences(JSON.parse(stored));
  } catch { /* Use the in-memory preference when storage is unavailable. */ }
  snapshots.set(key, value);
  return value;
}

const subscribe = (callback: () => void) => {
  const notify = () => { snapshots.clear(); callback(); };
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(eventName, notify); window.removeEventListener("storage", notify); };
};

export function savePauseReminderPreferences(userId: string | null, value: PauseReminderPreferences) {
  const parsed = preferencesSchema.parse(value);
  const key = storageKey(userId);
  memory.set(key, parsed);
  snapshots.set(key, parsed);
  try { localStorage.setItem(key, JSON.stringify(parsed)); } catch { /* Keep working for this browser session. */ }
  window.dispatchEvent(new Event(eventName));
}

export function usePauseReminderPreferences(userId: string | null, ready: boolean) {
  const getSnapshot = useCallback(() => ready ? read(userId) : defaultPauseReminderPreferences, [ready, userId]);
  const preferences = useSyncExternalStore(subscribe, getSnapshot, () => defaultPauseReminderPreferences);
  return useMemo(() => ({
    preferences,
    save: (value: PauseReminderPreferences) => savePauseReminderPreferences(userId, value),
  }), [preferences, userId]);
}
