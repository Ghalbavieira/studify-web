import test from "node:test";
import assert from "node:assert/strict";
import { defaultPauseReminderPreferences, parsePauseReminderPreferences, reminderNumber, savePauseReminderPreferences } from "./pause-reminders.ts";

test("pause reminders are optional and default to 50 minutes", () => {
  assert.equal(defaultPauseReminderPreferences.enabled, false);
  assert.equal(defaultPauseReminderPreferences.intervalMinutes, 50);
  assert.equal(reminderNumber(10_000, defaultPauseReminderPreferences), 0);
});

test("pause reminder emits one sequence number per configured interval", () => {
  const preferences = { ...defaultPauseReminderPreferences, enabled: true };
  assert.equal(reminderNumber(49 * 60 + 59, preferences), 0);
  assert.equal(reminderNumber(50 * 60, preferences), 1);
  assert.equal(reminderNumber(99 * 60, preferences), 1);
  assert.equal(reminderNumber(100 * 60, preferences), 2);
});

test("invalid persisted preferences safely fall back to defaults", () => {
  assert.deepEqual(parsePauseReminderPreferences({ enabled: true, intervalMinutes: 1, kinds: [] }), defaultPauseReminderPreferences);
});

test("preferences persist under a user-specific key", () => {
  const stored = new Map();
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = { setItem: (key, value) => stored.set(key, value) };
  globalThis.window = { dispatchEvent: () => true };
  try {
    savePauseReminderPreferences("user-a", { enabled: true, intervalMinutes: 35, kinds: ["water"] });
    assert.deepEqual(JSON.parse(stored.get("studify.pause-reminders.user-a")), { enabled: true, intervalMinutes: 35, kinds: ["water"] });
    assert.equal(stored.has("studify.pause-reminders.user-b"), false);
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
  }
});
