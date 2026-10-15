import { useEffect, useRef, useState } from 'react';

import { learningService } from '@/services/learningService';
import { musicService } from '@/services/musicService';
import type { UnifiedSearchKind, UnifiedSearchResult } from '@/types/unifiedSearch';

/** The results whose line says how much they hold: an artist's releases, a cantor's albums, an album's recordings. */
const COUNTED: ReadonlySet<UnifiedSearchKind> = new Set(['music_artist', 'learning_cantor', 'learning_album']);

export function countKey(result: Pick<UnifiedSearchResult, 'kind' | 'entityId'>): string {
  return result.kind + ':' + result.entityId;
}

async function countOf(result: UnifiedSearchResult, locale: string): Promise<number> {
  switch (result.kind) {
    case 'music_artist':
      return (await musicService.getArtist(result.entityId, locale)).releases.length;
    case 'learning_cantor':
      return (await learningService.getCantor(result.entityId, locale)).albums.length;
    default:
      return (await learningService.getAlbum(result.entityId, locale)).recordings.length;
  }
}

/**
 * How much each artist, cantor and album in the results holds, for the line
 * under its name (Coptic Vine design, "Search results": "4 releases", "2
 * albums"). The search does not carry these, so each is read once from the
 * entity's own payload and kept for the rest of the visit; one that cannot be
 * read is left without a line.
 */
export function useResultCounts(results: UnifiedSearchResult[], locale: string): Record<string, number | null> {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  // Asked for already, answered or not, so a new keystroke never asks twice.
  const requested = useRef(new Set<string>());

  useEffect(() => {
    const missing = results.filter((result) => COUNTED.has(result.kind) && !requested.current.has(countKey(result)));
    if (!missing.length) return;
    for (const result of missing) requested.current.add(countKey(result));

    void Promise.all(missing.map(async (result) => {
      try {
        return [countKey(result), await countOf(result, locale)] as const;
      } catch {
        return [countKey(result), null] as const;
      }
    })).then((pairs) => setCounts((current) => ({ ...current, ...Object.fromEntries(pairs) })));
  }, [locale, results]);

  return counts;
}
