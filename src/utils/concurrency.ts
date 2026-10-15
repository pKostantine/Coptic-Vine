/**
 * Runs `task` over `items` in order, at most `limit` at a time. Once one
 * fails, or `stopped()` says so, no further item starts; those already under
 * way are let finish, and the first failure is then thrown.
 */
export async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
  stopped: () => boolean = () => false,
): Promise<void> {
  let next = 0;
  const failures: unknown[] = [];
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (!failures.length && !stopped() && next < items.length) {
      const item = items[next];
      next += 1;
      try { await task(item); } catch (error) { failures.push(error); }
    }
  }));
  if (failures.length) throw failures[0];
}

/**
 * Calls `task` at most once every `intervalMs` however often it is asked for,
 * one call at a time, and always once more after the last ask, so the final
 * state is never missed. Failures are dropped: what it does is best-effort
 * bookkeeping. `stop()` cancels the call waiting and resolves once the one
 * under way has finished, so nothing it writes can land after the caller's
 * own final word.
 */
export function throttled(task: () => Promise<void>, intervalMs: number): { request(): void; stop(): Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastRun = 0;
  let running: Promise<void> = Promise.resolve();
  let stopped = false;
  return {
    request() {
      if (stopped || timer) return;
      timer = setTimeout(() => {
        timer = null;
        lastRun = Date.now();
        running = running.then(() => (stopped ? undefined : task())).catch(() => undefined);
      }, Math.max(0, lastRun + intervalMs - Date.now()));
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      await running;
    },
  };
}
