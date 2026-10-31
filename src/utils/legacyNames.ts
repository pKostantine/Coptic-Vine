/**
 * What the app keeps on a device is named for Coptic Vine (cv-). Earlier
 * builds kept it under the app's old name (chc-, for Coptic Hymns Centre):
 * each store moves what it finds under the old name to the new the first
 * time it reads or writes it, so nothing saved is lost. Once every device has
 * run a build that moved its things, these moves find nothing and can go.
 */

// One move per name for the life of the app: later reads find it done.
const moves = new Map<string, Promise<void>>();

/** Storage that may be missing (a private window, the server render). */
type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * What an earlier build kept in `storage` (localStorage) under `legacyKey`
 * moves to `key`. Kept under both, the new one is what the app has saved since.
 */
export function moveLegacyStorageKey(legacyKey: string, key: string, storage: KeyValueStore | null | undefined = globalThis.localStorage): void {
  if (!storage || moves.has(key)) return;
  moves.set(key, Promise.resolve());
  try {
    const legacy = storage.getItem(legacyKey);
    if (legacy === null) return;
    if (storage.getItem(key) === null) storage.setItem(key, legacy);
    storage.removeItem(legacyKey);
  } catch {
    // Storage that can't be read has nothing to move.
  }
}

/**
 * The file an earlier build kept at `legacyUri` moves to `uri`. Kept at both,
 * the new one is what the app has saved since, and the old one goes.
 */
export function moveLegacyFile(legacyUri: string, uri: string): Promise<void> {
  const known = moves.get(uri);
  if (known) return known;
  const move = (async () => {
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const [legacy, current] = await Promise.all([FileSystem.getInfoAsync(legacyUri), FileSystem.getInfoAsync(uri)]);
      if (!legacy.exists) return;
      if (current.exists) await FileSystem.deleteAsync(legacyUri, { idempotent: true });
      else await FileSystem.moveAsync({ from: legacyUri, to: uri });
    } catch {
      // Left where it was: the store reads as if new, and tries again next launch.
      moves.delete(uri);
    }
  })();
  moves.set(uri, move);
  return move;
}
