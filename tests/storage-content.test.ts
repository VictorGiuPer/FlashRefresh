import { describe, expect, it } from 'vitest';
import { validateContentData } from '../src/lib/content';
import { parseAppState, parseDeckStreaks, parseProgress } from '../src/lib/storage';

describe('content validation', () => {
  it('keeps valid unique records and ignores cards with missing decks', () => {
    const data = validateContentData({
      decks: [{ id: 'one', name: 'One' }, { id: 'one', name: 'Duplicate' }],
      cards: [
        { id: 'valid', deckId: 'one', topicTag: 'Topic', front: 'Front', back: 'Back' },
        { id: 'orphan', deckId: 'missing', topicTag: 'Topic', front: 'Front', back: 'Back' },
      ],
    });
    expect(data.decks).toHaveLength(1);
    expect(data.cards.map((card) => card.id)).toEqual(['valid']);
  });

  it('rejects a malformed root contract', () => {
    expect(() => validateContentData({ cards: [] })).toThrow();
  });
});

describe('local storage recovery', () => {
  it('returns safe defaults for malformed JSON', () => {
    expect(parseProgress('{broken')).toEqual({});
    expect(parseAppState('{broken')).toEqual({ lastSelectedDeckId: null });
  });

  it('keeps valid progress entries and ignores invalid ones', () => {
    const parsed = parseProgress(JSON.stringify({
      kept: { cardId: 'kept', deckId: 'deck', timesReviewed: 3, lastGrade: 4, intervalDays: 9, dueDate: '2026-09-08' },
      dropped: { cardId: 'wrong-id', deckId: 'deck', timesReviewed: -1, lastGrade: 9, intervalDays: -2, dueDate: 'tomorrow' },
    }));
    expect(Object.keys(parsed)).toEqual(['kept']);
    expect(parsed.kept.consecutiveMisses).toBe(0);
  });

  it('preserves a valid consecutive miss count', () => {
    const parsed = parseProgress(JSON.stringify({
      card: { cardId: 'card', deckId: 'deck', timesReviewed: 2, lastGrade: 1, consecutiveMisses: 2, intervalDays: 1, dueDate: '2026-09-01' },
    }));
    expect(parsed.card.consecutiveMisses).toBe(2);
  });

  it('accepts the exact persisted app state shape', () => {
    expect(parseAppState('{"lastSelectedDeckId":"deck"}')).toEqual({ lastSelectedDeckId: 'deck' });
    expect(parseAppState('{"lastSelectedDeckId":42}')).toEqual({ lastSelectedDeckId: null });
  });

  it('keeps valid deck streaks and ignores malformed entries', () => {
    expect(parseDeckStreaks('{broken')).toEqual({});
    expect(parseDeckStreaks(JSON.stringify({
      deck: { count: 4, lastCompletedDate: '2026-08-30' },
      invalidCount: { count: 0, lastCompletedDate: '2026-08-30' },
      invalidDate: { count: 2, lastCompletedDate: 'tomorrow' },
    }))).toEqual({ deck: { count: 4, lastCompletedDate: '2026-08-30' } });
  });
});
