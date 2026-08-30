import type { Card, CardProgress, Deck, Grade, ProgressMap } from '../types';

export function toLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

export function calculateInterval(previousInterval: number, grade: Grade): number {
  if (grade === 1) return 1;
  if (grade === 2) return Math.max(2, Math.round(previousInterval * 1.3));
  if (grade === 3) return Math.max(4, Math.round(previousInterval * 2.2));
  return Math.max(9, Math.round(previousInterval * 3));
}

export function gradeCard(
  card: Card,
  previous: CardProgress | undefined,
  grade: Grade,
  today = toLocalDateString(),
): CardProgress {
  const intervalDays = calculateInterval(previous?.intervalDays ?? 0, grade);
  return {
    cardId: card.id,
    deckId: card.deckId,
    timesReviewed: (previous?.timesReviewed ?? 0) + 1,
    lastGrade: grade,
    consecutiveMisses: grade === 1 ? (previous?.consecutiveMisses ?? 0) + 1 : 0,
    intervalDays,
    dueDate: addDays(today, intervalDays),
  };
}

export function isDue(progress: CardProgress | undefined, today = toLocalDateString()): boolean {
  return !progress?.dueDate || progress.dueDate <= today;
}

export function buildQueue(
  cards: Card[],
  progress: ProgressMap,
  deckId: string,
  today = toLocalDateString(),
): Card[] {
  return cards
    .map((card, sourceIndex) => ({ card, sourceIndex, progress: progress[card.id] }))
    .filter(({ card, progress: entry }) => card.deckId === deckId && isDue(entry, today))
    .sort((left, right) => {
      const leftDate = left.progress?.dueDate;
      const rightDate = right.progress?.dueDate;
      if (leftDate && rightDate) return leftDate.localeCompare(rightDate) || left.sourceIndex - right.sourceIndex;
      if (leftDate) return -1;
      if (rightDate) return 1;
      return left.sourceIndex - right.sourceIndex;
    })
    .map(({ card }) => card);
}

export function dueCount(cards: Card[], progress: ProgressMap, deckId: string, today = toLocalDateString()): number {
  return cards.filter((card) => card.deckId === deckId && isDue(progress[card.id], today)).length;
}

export function selectDefaultDeck(decks: Deck[], lastSelectedDeckId: string | null): string | null {
  if (lastSelectedDeckId && decks.some((deck) => deck.id === lastSelectedDeckId)) return lastSelectedDeckId;
  return [...decks].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))[0]?.id ?? null;
}
