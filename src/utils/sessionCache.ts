/**
 * What a page last read from the server, kept for the rest of the session:
 * drawn at once when the page opens again (a tab revisited, a release played
 * from its cover and then opened), while it is read afresh behind it. Reads
 * of the same thing under way at the same time share one request.
 */
export interface SessionCache<T> {
  /** The last answer for `key`, or null when there is none yet. */
  peek: (key: string) => T | null;
  /** Reads `key` afresh -- or joins a read already under way -- and keeps the answer. */
  load: (key: string, read: () => Promise<T>) => Promise<T>;
  /** Forgets every answer: what was read has changed (a like, a playlist edited). */
  clear: () => void;
}

const everyCache: SessionCache<unknown>[] = [];

export function createSessionCache<T>(): SessionCache<T> {
  const answers = new Map<string, T>();
  const reading = new Map<string, Promise<T>>();
  // A read that set out before a clear must not bring back what the clear forgot.
  let generation = 0;
  const cache: SessionCache<T> = {
    peek: (key) => answers.get(key) ?? null,
    load: (key, read) => {
      const underWay = reading.get(key);
      if (underWay) return underWay;
      const startedIn = generation;
      const request = read().then(
        (answer) => {
          if (startedIn === generation) answers.set(key, answer);
          return answer;
        },
      ).finally(() => {
        if (reading.get(key) === request) reading.delete(key);
      });
      reading.set(key, request);
      return request;
    },
    clear: () => {
      generation += 1;
      answers.clear();
      reading.clear();
    },
  };
  everyCache.push(cache as SessionCache<unknown>);
  return cache;
}

/** Forgets every session cache: a sign-in or sign-out changes whose library is whose. */
export function clearSessionCaches(): void {
  for (const cache of everyCache) cache.clear();
}
