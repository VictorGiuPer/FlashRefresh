import { describe, expect, it } from 'vitest';
import { addDays, buildQueue, calculateInterval, gradeCard, isDue, selectDefaultDeck, toLocalDateString } from '../src/lib/scheduler';
import type { Card, CardProgress, Deck, ProgressMap } from '../src/types';

const cards: Card[] = [
  { id: 'new-1', deckId: 'deck', topicTag: 'Topic', front: 'New one', back: 'Answer' },
  { id: 'old-1', deckId: 'deck', topicTag: 'Topic', front: 'Old one', back: 'Answer' },
  { id: 'old-2', deckId: 'deck', topicTag: 'Topic', front: 'Older one', back: 'Answer' },
  { id: 'future', deckId: 'deck', topicTag: 'Topic', front: 'Future', back: 'Answer' },
  { id: 'other', deckId: 'other', topicTag: 'Topic', front: 'Other', back: 'Answer' },
];

const progressEntry = (cardId: string, dueDate: string, intervalDays = 4): CardProgress => ({
  cardId,
  deckId: 'deck',
  timesReviewed: 1,
  lastGrade: 3,
  consecutiveMisses: 0,
  intervalDays,
  dueDate,
});

describe('interval scheduling', () => {
  it('applies every grade formula and minimum', () => {
    expect(calculateInterval(30, 1)).toBe(1);
    expect(calculateInterval(0, 2)).toBe(2);
    expect(calculateInterval(10, 2)).toBe(13);
    expect(calculateInterval(0, 3)).toBe(4);
    expect(calculateInterval(5, 3)).toBe(11);
    expect(calculateInterval(0, 4)).toBe(9);
    expect(calculateInterval(4, 4)).toBe(12);
  });

  it('grades new cards from interval zero and uses the card’s current deck', () => {
    const moved = { ...cards[0], deckId: 'new-deck' };
    const result = gradeCard(moved, { ...progressEntry(moved.id, '2026-08-30'), deckId: 'old-deck' }, 4, '2026-08-30');
    expect(result).toMatchObject({ cardId: moved.id, deckId: 'new-deck', timesReviewed: 2, intervalDays: 12, dueDate: '2026-09-11' });
    expect(gradeCard(moved, undefined, 4, '2026-08-30').intervalDays).toBe(9);
  });

  it('flags repeated misses and clears the streak after any remembered grade', () => {
    const firstMiss = gradeCard(cards[0], undefined, 1, '2026-08-30');
    const secondMiss = gradeCard(cards[0], firstMiss, 1, '2026-08-31');
    const recovered = gradeCard(cards[0], secondMiss, 2, '2026-09-01');
    expect(firstMiss.consecutiveMisses).toBe(1);
    expect(secondMiss.consecutiveMisses).toBe(2);
    expect(recovered.consecutiveMisses).toBe(0);
  });

  it('uses local calendar dates and crosses month boundaries safely', () => {
    expect(addDays('2026-10-25', 9)).toBe('2026-11-03');
    expect(toLocalDateString(new Date(2026, 0, 2, 0, 15))).toBe('2026-01-02');
  });
});

describe('queues and deck selection', () => {
  it('includes null and today, excludes future, and orders overdue before new', () => {
    const progress: ProgressMap = {
      'old-1': progressEntry('old-1', '2026-08-29'),
      'old-2': progressEntry('old-2', '2026-08-20'),
      future: progressEntry('future', '2026-08-31'),
    };
    expect(buildQueue(cards, progress, 'deck', '2026-08-30').map((card) => card.id)).toEqual(['old-2', 'old-1', 'new-1']);
    expect(isDue(progress['old-1'], '2026-08-29')).toBe(true);
    expect(isDue(progress.future, '2026-08-30')).toBe(false);
  });

  it('keeps source order for new cards and equal due dates', () => {
    const sameDayCards = [cards[1], cards[2], cards[0]];
    const progress: ProgressMap = {
      'old-1': progressEntry('old-1', '2026-08-20'),
      'old-2': progressEntry('old-2', '2026-08-20'),
    };
    expect(buildQueue(sameDayCards, progress, 'deck', '2026-08-30').map((card) => card.id)).toEqual(['old-1', 'old-2', 'new-1']);
  });

  it('restores a valid deck and otherwise chooses alphabetically', () => {
    const decks: Deck[] = [{ id: 'z', name: 'Zulu' }, { id: 'a', name: 'Alpha' }];
    expect(selectDefaultDeck(decks, 'z')).toBe('z');
    expect(selectDefaultDeck(decks, 'removed')).toBe('a');
    expect(selectDefaultDeck([], null)).toBeNull();
  });
});
