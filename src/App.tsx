import {
  Check,
  ChevronDown,
  ChevronRight,
  Flame,
  Layers3,
  List,
  Search,
  X,
} from 'lucide-react';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchContent } from './lib/content';
import { addDays, buildQueue, completeDeckStreak, dueCount, dueCountOnDate, gradeCard, selectDefaultDeck, toLocalDateString, visibleStreak } from './lib/scheduler';
import { loadAppState, loadDeckStreaks, loadProgress, saveAppState, saveDeckStreaks, saveProgress } from './lib/storage';
import type { Card, ContentData, Deck, DeckStreakMap, Grade, ProgressMap, SessionStats } from './types';

type Tab = 'learn' | 'manage';

type DeckSession = {
  queue: Card[];
  index: number;
  flipped: boolean;
  stats: SessionStats;
};

const emptyStats = (): SessionStats => ({ 1: 0, 2: 0, 3: 0, 4: 0 });

const gradeLabels: Record<Grade, string> = {
  1: "Didn't know it",
  2: 'Kind of remembered',
  3: 'Mostly remembered',
  4: 'Knew it well',
};

const logoSrc = `${import.meta.env.BASE_URL}flashfresh-logo-marble-v4.png`;

function Wordmark() {
  return (
    <span className="wordmark" aria-label="Flash Refresh">
      <img className="brand-logo" src={logoSrc} alt="" aria-hidden="true" />
      <span>Flash <em>Refresh</em></span>
    </span>
  );
}

function LoadingScreen() {
  return (
    <main className="splash" aria-live="polite" aria-label="Loading Flash Refresh">
      <Wordmark />
      <span className="loading-line" aria-hidden="true" />
    </main>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="empty-state">
      <span className="empty-monogram" aria-hidden="true">F</span>
      <h2>Quiet for now</h2>
      <p>{message}</p>
    </section>
  );
}

function DeckSheet({
  decks,
  selectedDeckId,
  progress,
  cards,
  onSelect,
  onClose,
}: {
  decks: Deck[];
  selectedDeckId: string | null;
  progress: ProgressMap;
  cards: Card[];
  onSelect: (deckId: string) => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusable = [...sheetRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [onClose]);

  return (
    <div className="sheet-scrim" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="deck-sheet glass" role="dialog" aria-modal="true" aria-labelledby="deck-sheet-title" ref={sheetRef}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">Study focus</p>
            <h2 id="deck-sheet-title">Choose a deck</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close deck switcher">
            <X aria-hidden="true" size={19} strokeWidth={1.5} />
          </button>
        </header>
        <div className="deck-options">
          {decks.map((deck) => {
            const selected = deck.id === selectedDeckId;
            const count = dueCount(cards, progress, deck.id);
            return (
              <button
                className={`deck-option${selected ? ' selected' : ''}`}
                type="button"
                key={deck.id}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(deck.id)}
              >
                <span>{deck.name}</span>
                <span className="deck-due">{count} due</span>
                {selected && <Check aria-hidden="true" size={17} strokeWidth={1.5} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudyCard({
  card,
  flipped,
  leaving,
  onToggleFace,
}: {
  card: Card;
  flipped: boolean;
  leaving: boolean;
  onToggleFace: () => void;
}) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const ignoreClick = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pointerStart.current) return;
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    pointerStart.current = null;
    const revealsBack = !flipped && deltaY < -48;
    const returnsFront = flipped && deltaY > 48;
    if ((revealsBack || returnsFront) && Math.abs(deltaX) < 72) {
      ignoreClick.current = true;
      onToggleFace();
    }
  };

  const onClick = () => {
    if (ignoreClick.current) {
      ignoreClick.current = false;
      return;
    }
    onToggleFace();
  };

  return (
    <button
      className={`study-card${leaving ? ' leaving' : ''}`}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      aria-label={flipped ? 'Show question' : 'Show answer'}
    >
      <span className={`card-inner${flipped ? ' flipped' : ''}`}>
        <span className="card-face card-front">
          <span className="face-label"><b>F</b>ront</span>
          <span className="card-copy question">{card.front}</span>
          <span className="flip-hint">Tap or swipe up to reveal</span>
        </span>
        <span className="card-face card-back">
          <span className="face-label"><b>B</b>ack</span>
          <span className="card-copy answer">{card.back}</span>
          <span className="topic-chip">{card.topicTag}</span>
          <span className="flip-hint">Tap or swipe down to return</span>
        </span>
      </span>
    </button>
  );
}

function LearnView({
  content,
  selectedDeckId,
  sessions,
  progress,
  streaks,
  leaving,
  onOpenDecks,
  onToggleFace,
  onGrade,
}: {
  content: ContentData;
  selectedDeckId: string | null;
  sessions: Record<string, DeckSession>;
  progress: ProgressMap;
  streaks: DeckStreakMap;
  leaving: boolean;
  onOpenDecks: () => void;
  onToggleFace: () => void;
  onGrade: (grade: Grade) => void;
}) {
  if (!content.decks.length) return <EmptyState message="No cards yet — waiting on the next sync." />;

  const deck = content.decks.find((item) => item.id === selectedDeckId);
  const session = selectedDeckId ? sessions[selectedDeckId] : undefined;
  if (!deck || !session) return <LoadingScreen />;

  const currentCard = session.queue[session.index];
  const complete = !currentCard;
  const reviewed = Object.values(session.stats).reduce((sum, count) => sum + count, 0);
  const position = complete ? session.queue.length : session.index + 1;
  const progressPercent = session.queue.length ? (position / session.queue.length) * 100 : 100;
  const streak = visibleStreak(streaks[deck.id]);
  const tomorrowCount = dueCountOnDate(content.cards, progress, deck.id, addDays(toLocalDateString(), 1));

  return (
    <section className="screen learn-screen" aria-labelledby="learn-title">
      <header className="app-header learn-header">
        <div className="learn-brand-row">
          <h1 id="learn-title"><Wordmark /></h1>
          <span className="streak-indicator" aria-label={`${streak}-day streak for ${deck.name}`}>
            <Flame aria-hidden="true" size={21} strokeWidth={1.5} />
            <b>{streak}</b>
          </span>
        </div>
        <button className="deck-pill glass" type="button" onClick={onOpenDecks}>
          <span>{deck.name}</span>
          <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} />
        </button>
      </header>

      {!complete && (
        <>
          <div className="progress-meta">
            <span>{position} of {session.queue.length} due</span>
            <span>Study queue</span>
          </div>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <StudyCard card={currentCard} flipped={session.flipped} leaving={leaving} onToggleFace={onToggleFace} />
          <div className={`grade-grid${session.flipped ? ' visible' : ''}`} aria-hidden={!session.flipped}>
            {([1, 2, 3, 4] as Grade[]).map((grade) => (
              <button type="button" key={grade} disabled={!session.flipped || leaving} onClick={() => onGrade(grade)}>
                {gradeLabels[grade]}
              </button>
            ))}
          </div>
        </>
      )}

      {complete && (
        <section className="completion-state">
          <span className="completion-mark" aria-hidden="true"><Check size={28} strokeWidth={1.25} /></span>
          <p className="eyebrow">{deck.name}</p>
          <h2>All caught up</h2>
          <p>{reviewed ? `${reviewed} card${reviewed === 1 ? '' : 's'} reviewed this session.` : 'Nothing is due in this deck.'}</p>
          <p className="tomorrow-forecast">Tomorrow: {tomorrowCount} card{tomorrowCount === 1 ? '' : 's'} due.</p>
          {reviewed > 0 && (
            <div className="session-summary" aria-label="Session results">
              {([1, 2, 3, 4] as Grade[]).map((grade) => (
                <span key={grade}><b>{session.stats[grade]}</b>{gradeLabels[grade]}</span>
              ))}
            </div>
          )}
          <button className="primary-button" type="button" onClick={onOpenDecks}>Switch decks</button>
        </section>
      )}
    </section>
  );
}

function ManageView({ content, selectedDeckId, progress }: { content: ContentData; selectedDeckId: string | null; progress: ProgressMap }) {
  const [query, setQuery] = useState('');
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(() => new Set(selectedDeckId ? [selectedDeckId] : []));
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedDeckId) setExpandedDecks((current) => new Set(current).add(selectedDeckId));
  }, [selectedDeckId]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSections = content.decks.map((deck) => {
    const allCards = content.cards.filter((card) => card.deckId === deck.id);
    const cards = normalizedQuery
      ? allCards.filter((card) => [card.front, card.back, card.topicTag].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
      : allCards;
    const attentionCount = allCards.filter((card) => (progress[card.id]?.consecutiveMisses ?? 0) >= 2).length;
    return { deck, cards, allCount: allCards.length, attentionCount };
  }).filter(({ cards }) => !normalizedQuery || cards.length > 0);

  const toggleDeck = (deckId: string) => {
    if (normalizedQuery) return;
    setExpandedDecks((current) => {
      const next = new Set(current);
      if (next.has(deckId)) next.delete(deckId); else next.add(deckId);
      return next;
    });
  };

  const toggleCard = (cardId: string) => {
    setExpandedCards((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  };

  return (
    <section className="screen manage-screen" aria-labelledby="manage-title">
      <header className="app-header manage-header">
        <h1 id="manage-title"><Wordmark /></h1>
        <p className="eyebrow">Read-only library</p>
      </header>

      <div className="search-box glass">
        <Search aria-hidden="true" size={18} strokeWidth={1.5} />
        <input aria-label="Search cards" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards…" type="search" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
            <X aria-hidden="true" size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {!content.decks.length && <EmptyState message="No cards yet — waiting on the next sync." />}
      {!!content.decks.length && !visibleSections.length && (
        <section className="no-results"><h2>No matches</h2><p>Try a different word or topic.</p></section>
      )}

      <div className="deck-sections">
        {visibleSections.map(({ deck, cards, allCount, attentionCount }) => {
          const expanded = normalizedQuery ? true : expandedDecks.has(deck.id);
          return (
            <section className="deck-section glass" key={deck.id}>
              <button className="deck-section-toggle" type="button" onClick={() => toggleDeck(deck.id)} aria-expanded={expanded}>
                <span>
                  <b>{deck.name}</b>
                  <small>
                    {normalizedQuery ? cards.length : allCount} card{(normalizedQuery ? cards.length : allCount) === 1 ? '' : 's'}
                    {attentionCount > 0 && <> · {attentionCount} need{attentionCount === 1 ? 's' : ''} attention</>}
                  </small>
                </span>
                <ChevronRight className={expanded ? 'rotated' : ''} aria-hidden="true" size={19} strokeWidth={1.5} />
              </button>
              {expanded && (
                <div className="card-rows">
                  {cards.length === 0 && <p className="deck-empty">No cards in this deck yet.</p>}
                  {cards.map((card) => {
                    const cardExpanded = expandedCards.has(card.id);
                    const needsAttention = (progress[card.id]?.consecutiveMisses ?? 0) >= 2;
                    return (
                      <button className={`card-row${cardExpanded ? ' expanded' : ''}`} type="button" key={card.id} onClick={() => toggleCard(card.id)} aria-expanded={cardExpanded}>
                        <span className="card-row-top">
                          <span className="card-row-front">{card.front}</span>
                        </span>
                        {cardExpanded && (
                          <span className="card-row-detail">
                            {needsAttention && <span className="attention-chip">Needs attention</span>}
                            <span className="topic-chip">{card.topicTag}</span>
                            <span className="card-row-back">{card.back}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>('learn');
  const [content, setContent] = useState<ContentData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());
  const [streaks, setStreaks] = useState<DeckStreakMap>(() => loadDeckStreaks());
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, DeckSession>>({});
  const [deckSheetOpen, setDeckSheetOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const deckTriggerRef = useRef<HTMLButtonElement | null>(null);
  const transitionTimer = useRef<number | null>(null);

  const loadCards = useCallback(async () => {
    setLoadError(null);
    try {
      const nextContent = await fetchContent();
      const nextDeckId = selectDefaultDeck(nextContent.decks, loadAppState().lastSelectedDeckId);
      setContent(nextContent);
      setSelectedDeckId(nextDeckId);
      setSessions({});
      if (nextDeckId) saveAppState({ lastSelectedDeckId: nextDeckId });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The card library could not be loaded.');
    }
  }, []);

  useEffect(() => { void loadCards(); }, [loadCards]);
  useEffect(() => () => { if (transitionTimer.current) window.clearTimeout(transitionTimer.current); }, []);

  useEffect(() => {
    if (!content || !selectedDeckId || sessions[selectedDeckId]) return;
    setSessions((current) => ({
      ...current,
      [selectedDeckId]: {
        queue: buildQueue(content.cards, progress, selectedDeckId),
        index: 0,
        flipped: false,
        stats: emptyStats(),
      },
    }));
  }, [content, progress, selectedDeckId, sessions]);

  const selectedSession = selectedDeckId ? sessions[selectedDeckId] : undefined;

  const chooseDeck = (deckId: string) => {
    setSelectedDeckId(deckId);
    saveAppState({ lastSelectedDeckId: deckId });
    setDeckSheetOpen(false);
    setLeaving(false);
    window.setTimeout(() => deckTriggerRef.current?.focus(), 0);
  };

  const updateSession = (updater: (session: DeckSession) => DeckSession) => {
    if (!selectedDeckId) return;
    setSessions((current) => current[selectedDeckId]
      ? { ...current, [selectedDeckId]: updater(current[selectedDeckId]) }
      : current);
  };

  const toggleCardFace = () => updateSession((session) => ({ ...session, flipped: !session.flipped }));

  const recordGrade = (grade: Grade) => {
    if (!selectedDeckId || !selectedSession || leaving) return;
    const card = selectedSession.queue[selectedSession.index];
    if (!card || !selectedSession.flipped) return;

    const entry = gradeCard(card, progress[card.id], grade);
    const nextProgress = { ...progress, [card.id]: entry };
    setProgress(nextProgress);
    saveProgress(nextProgress);
    if (selectedSession.queue.length > 0 && selectedSession.index + 1 === selectedSession.queue.length) {
      const nextStreaks = {
        ...streaks,
        [selectedDeckId]: completeDeckStreak(streaks[selectedDeckId]),
      };
      setStreaks(nextStreaks);
      saveDeckStreaks(nextStreaks);
    }
    setLeaving(true);
    transitionTimer.current = window.setTimeout(() => {
      updateSession((session) => ({
        ...session,
        index: session.index + 1,
        flipped: false,
        stats: { ...session.stats, [grade]: session.stats[grade] + 1 },
      }));
      setLeaving(false);
    }, 200);
  };

  const openDeckSheet = () => setDeckSheetOpen(true);
  const closeDeckSheet = useCallback(() => {
    setDeckSheetOpen(false);
    window.setTimeout(() => deckTriggerRef.current?.focus(), 0);
  }, []);

  const selectedDeckName = useMemo(
    () => content?.decks.find((deck) => deck.id === selectedDeckId)?.name,
    [content, selectedDeckId],
  );

  if (!content && !loadError) return <LoadingScreen />;

  if (!content && loadError) {
    return (
      <main className="error-screen">
        <Wordmark />
        <section className="error-panel glass" role="alert">
          <p className="eyebrow">Library unavailable</p>
          <h1>We couldn’t open your cards</h1>
          <p>{loadError}</p>
          <button className="primary-button" type="button" onClick={() => void loadCards()}>Try again</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {tab === 'learn' ? (
        <div ref={(node) => {
          deckTriggerRef.current = node?.querySelector<HTMLButtonElement>('.deck-pill') ?? null;
        }}>
          <LearnView
            content={content!}
            selectedDeckId={selectedDeckId}
            sessions={sessions}
            progress={progress}
            streaks={streaks}
            leaving={leaving}
            onOpenDecks={openDeckSheet}
            onToggleFace={toggleCardFace}
            onGrade={recordGrade}
          />
        </div>
      ) : (
        <ManageView content={content!} selectedDeckId={selectedDeckId} progress={progress} />
      )}

      <nav className="tab-bar glass" aria-label="Primary navigation">
        <button className={`tab${tab === 'learn' ? ' active' : ''}`} type="button" onClick={() => setTab('learn')} aria-current={tab === 'learn' ? 'page' : undefined}>
          <Layers3 aria-hidden="true" size={21} strokeWidth={1.5} />
          <span>Learn</span>
        </button>
        <button className={`tab${tab === 'manage' ? ' active' : ''}`} type="button" onClick={() => setTab('manage')} aria-current={tab === 'manage' ? 'page' : undefined}>
          <List aria-hidden="true" size={21} strokeWidth={1.5} />
          <span>Manage</span>
        </button>
      </nav>

      {deckSheetOpen && content!.decks.length > 0 && (
        <DeckSheet
          decks={content!.decks}
          selectedDeckId={selectedDeckId}
          progress={progress}
          cards={content!.cards}
          onSelect={chooseDeck}
          onClose={closeDeckSheet}
        />
      )}
      <span className="sr-only" aria-live="polite">{selectedDeckName ? `${selectedDeckName} selected` : ''}</span>
    </main>
  );
}
