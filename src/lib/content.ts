import type { Card, ContentData, Deck } from '../types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isDeck = (value: unknown): value is Deck =>
  isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name);

const isCard = (value: unknown): value is Card =>
  isRecord(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.deckId) &&
  typeof value.topicTag === 'string' &&
  isNonEmptyString(value.front) &&
  isNonEmptyString(value.back);

export function validateContentData(value: unknown): ContentData {
  if (!isRecord(value) || !Array.isArray(value.decks) || !Array.isArray(value.cards)) {
    throw new Error('The card library is not in the expected format.');
  }

  const seenDecks = new Set<string>();
  const decks = value.decks.filter((deck): deck is Deck => {
    if (!isDeck(deck) || seenDecks.has(deck.id)) return false;
    seenDecks.add(deck.id);
    return true;
  });

  const validDeckIds = new Set(decks.map((deck) => deck.id));
  const seenCards = new Set<string>();
  const cards = value.cards.filter((card): card is Card => {
    if (!isCard(card) || !validDeckIds.has(card.deckId) || seenCards.has(card.id)) return false;
    seenCards.add(card.id);
    return true;
  });

  return { decks, cards };
}

export async function fetchContent(): Promise<ContentData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/cards.json`);
  if (!response.ok) throw new Error('The card library could not be loaded.');
  return validateContentData(await response.json());
}
