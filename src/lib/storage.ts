import type { AppState, CardProgress, DeckStreak, DeckStreakMap, Grade, ProgressMap } from '../types';

export const PROGRESS_KEY = 'flashRefresh.progress';
export const APP_STATE_KEY = 'flashRefresh.appState';
export const DECK_STREAKS_KEY = 'flashRefresh.deckStreaks';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isGrade = (value: unknown): value is Grade | null =>
  value === null || value === 1 || value === 2 || value === 3 || value === 4;

const isDate = (value: unknown): value is string | null =>
  value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));

function isProgress(value: unknown, cardId: string): value is Omit<CardProgress, 'consecutiveMisses'> & { consecutiveMisses?: number } {
  return isRecord(value) &&
    value.cardId === cardId &&
    typeof value.deckId === 'string' &&
    Number.isInteger(value.timesReviewed) && Number(value.timesReviewed) >= 0 &&
    isGrade(value.lastGrade) &&
    (value.consecutiveMisses === undefined || (Number.isInteger(value.consecutiveMisses) && Number(value.consecutiveMisses) >= 0)) &&
    Number.isInteger(value.intervalDays) && Number(value.intervalDays) >= 0 &&
    isDate(value.dueDate);
}

export function parseProgress(raw: string | null): ProgressMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return Object.entries(parsed).reduce<ProgressMap>((valid, [cardId, value]) => {
      if (isProgress(value, cardId)) {
        valid[cardId] = { ...value, consecutiveMisses: value.consecutiveMisses ?? 0 };
      }
      return valid;
    }, {});
  } catch {
    return {};
  }
}

export function parseAppState(raw: string | null): AppState {
  if (!raw) return { lastSelectedDeckId: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && (typeof parsed.lastSelectedDeckId === 'string' || parsed.lastSelectedDeckId === null)) {
      return { lastSelectedDeckId: parsed.lastSelectedDeckId };
    }
  } catch {
    // Fall through to the safe default.
  }
  return { lastSelectedDeckId: null };
}

function isDeckStreak(value: unknown): value is DeckStreak {
  return isRecord(value) &&
    Number.isInteger(value.count) && Number(value.count) > 0 &&
    typeof value.lastCompletedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.lastCompletedDate);
}

export function parseDeckStreaks(raw: string | null): DeckStreakMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return Object.entries(parsed).reduce<DeckStreakMap>((valid, [deckId, value]) => {
      if (isDeckStreak(value)) valid[deckId] = value;
      return valid;
    }, {});
  } catch {
    return {};
  }
}

export function loadProgress(): ProgressMap {
  try { return parseProgress(localStorage.getItem(PROGRESS_KEY)); } catch { return {}; }
}

export function loadAppState(): AppState {
  try { return parseAppState(localStorage.getItem(APP_STATE_KEY)); } catch { return { lastSelectedDeckId: null }; }
}

export function loadDeckStreaks(): DeckStreakMap {
  try { return parseDeckStreaks(localStorage.getItem(DECK_STREAKS_KEY)); } catch { return {}; }
}

export function saveProgress(progress: ProgressMap): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* Continue in memory. */ }
}

export function saveAppState(state: AppState): void {
  try { localStorage.setItem(APP_STATE_KEY, JSON.stringify(state)); } catch { /* Continue in memory. */ }
}

export function saveDeckStreaks(streaks: DeckStreakMap): void {
  try { localStorage.setItem(DECK_STREAKS_KEY, JSON.stringify(streaks)); } catch { /* Continue in memory. */ }
}
