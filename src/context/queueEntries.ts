import type { PlaybackQueueEntry } from '../types/playback';
import type { LearningQueueItem } from './LearningPlayerContext';
import type { MusicQueueItem } from './MusicPlayerContext';

/**
 * One queue, two kinds of listening. The playback engine (PlaybackContext)
 * holds a single queue whose entries carry either a Music track or a Learn &
 * Study item as their payload, in whatever order they were queued — a hymn to
 * learn after a song, a song after a lesson. These views let a list show that
 * queue as it is, every row knowing which kind it is, under the engine's own
 * indices, so selecting and reordering act on the right entry whichever
 * player the list is open in.
 */
export type QueueEntryView =
  | { key: string; kind: 'music'; item: MusicQueueItem }
  | { key: string; kind: 'learning'; item: LearningQueueItem }
  /** An entry this version cannot read (a snapshot saved by a newer app): shown by its title, never dropped, so the indices stay the engine's. */
  | { key: string; kind: 'other'; title: string; subtitle: string | null };

export function isMusicQueueItem(value: unknown): value is MusicQueueItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MusicQueueItem>;
  return Boolean(candidate.track && typeof candidate.track === 'object' && typeof candidate.track.id === 'string');
}

export function isLearningQueueItem(value: unknown): value is LearningQueueItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LearningQueueItem>;
  return (item.kind === 'recording' || item.kind === 'lesson')
    && typeof item.id === 'string'
    && typeof item.title === 'string'
    && Boolean(item.mediaAsset);
}

export function describeQueueEntry(entry: PlaybackQueueEntry): QueueEntryView {
  if (isMusicQueueItem(entry.payload)) return { key: entry.key, kind: 'music', item: entry.payload };
  if (isLearningQueueItem(entry.payload)) return { key: entry.key, kind: 'learning', item: entry.payload };
  return { key: entry.key, kind: 'other', title: entry.playable.title, subtitle: entry.playable.artist ?? null };
}

/** The engine's queue as a list shows it: one view per entry, in the engine's order. */
export function describeQueue(entries: readonly PlaybackQueueEntry[]): QueueEntryView[] {
  return entries.map(describeQueueEntry);
}
