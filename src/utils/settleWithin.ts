/**
 * Awaits best-effort work that must not be able to hold up what follows it.
 *
 * Rejections are logged rather than thrown, and — the reason this exists — a
 * task that never settles is abandoned once the deadline passes. Sign-out used
 * to await its notification cleanup unbounded, and one promise inside that
 * cleanup never resolving left people unable to sign out at all, with no error
 * to show for it.
 *
 * Resolves once every task has settled, or once `timeoutMs` has elapsed,
 * whichever comes first. It never rejects.
 */
export function settleWithin(tasks: Promise<unknown>[], timeoutMs: number, label: string): Promise<void> {
  const settled = Promise.allSettled(tasks).then((results) => {
    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn(`${label}:`, result.reason);
      }
    }
  });

  return Promise.race([
    settled,
    new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn(`${label}: timed out after ${timeoutMs}ms; continuing anyway.`);
        resolve();
      }, timeoutMs);
    }),
  ]);
}
