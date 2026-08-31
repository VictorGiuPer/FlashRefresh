import type { Card, ContentData, Deck } from '../types.ts';

type DeckFileCard = Omit<Card, 'deckId'>;

type DeckFile = Deck & {
  cards: DeckFileCard[];
};

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

const isDeckFileCard = (value: unknown): value is DeckFileCard =>
  isRecord(value) &&
  !('deckId' in value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.topicTag) &&
  isNonEmptyString(value.front) &&
  isNonEmptyString(value.back);

const isDeckFile = (value: unknown): value is DeckFile =>
  isRecord(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.name) &&
  Array.isArray(value.cards);

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

/** Validates authored deck files and derives each card's deck ID from its file. */
export function validateDeckFiles(files: unknown[]): ContentData {
  const decks: Deck[] = [];
  const cards: Card[] = [];
  const seenDeckIds = new Set<string>();
  const seenCardIds = new Set<string>();

  files.forEach((file, fileIndex) => {
    const label = `Deck file ${fileIndex + 1}`;
    if (!isDeckFile(file)) throw new Error(`${label} is not in the expected format.`);
    if (seenDeckIds.has(file.id)) throw new Error(`${label} repeats deck ID "${file.id}".`);
    seenDeckIds.add(file.id);
    decks.push({ id: file.id, name: file.name });

    file.cards.forEach((card, cardIndex) => {
      if (!isDeckFileCard(card)) throw new Error(`${label} has an invalid card at position ${cardIndex + 1}.`);
      if (seenCardIds.has(card.id)) throw new Error(`${label} repeats card ID "${card.id}".`);
      seenCardIds.add(card.id);
      cards.push({ ...card, deckId: file.id });
    });
  });

  return { decks, cards };
}

export async function fetchContent(): Promise<ContentData> {
  const manifestResponse = await fetch(`${import.meta.env.BASE_URL}data/decks.json`);
  if (!manifestResponse.ok) throw new Error('The card library could not be loaded.');

  const manifest: unknown = await manifestResponse.json();
  if (!isRecord(manifest) || !Array.isArray(manifest.files) || !manifest.files.every((file) => typeof file === 'string')) {
    throw new Error('The card library manifest is not in the expected format.');
  }

  const deckResponses = await Promise.all(manifest.files.map((file) => fetch(`${import.meta.env.BASE_URL}${file}`)));
  if (deckResponses.some((response) => !response.ok)) throw new Error('A deck could not be loaded.');
  return validateDeckFiles(await Promise.all(deckResponses.map((response) => response.json())));
}
