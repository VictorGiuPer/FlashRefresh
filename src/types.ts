export type Grade = 1 | 2 | 3 | 4;

export type Deck = {
  id: string;
  name: string;
};

export type Card = {
  id: string;
  deckId: string;
  topicTag: string;
  front: string;
  back: string;
};

export type ContentData = {
  decks: Deck[];
  cards: Card[];
};

export type CardProgress = {
  cardId: string;
  deckId: string;
  timesReviewed: number;
  lastGrade: Grade | null;
  consecutiveMisses: number;
  intervalDays: number;
  dueDate: string | null;
};

export type ProgressMap = Record<string, CardProgress>;

export type DeckStreak = {
  count: number;
  lastCompletedDate: string;
};

export type DeckStreakMap = Record<string, DeckStreak>;

export type AppState = {
  lastSelectedDeckId: string | null;
};

export type SessionStats = Record<Grade, number>;
