import { File } from 'expo-file-system';
import * as Network from 'expo-network';

import {
  DOWNLOADABLE_BOOK_KEYS,
  DOWNLOADABLE_BOOKS,
  resourcesForBook,
  validatePublishedManifest,
} from '@/constants/bookDependencyRegistry';
import {
  activateBookResources,
  activateSystemResource,
  cleanupObsoleteResourceVersions,
  getActiveResourceVersion,
  getBook as getStoredBook,
  getContentSetting,
  getResourcePackageKeys,
  importContentChunk,
  isContentChunkImported,
  listBooks as listStoredBooks,
  listResources as listStoredResources,
  removeBookReferences,
  seedBookRows,
  setPendingBookResources,
  setBookState,
  setContentSetting,
  setResourceState,
} from '@/services/bookContentDatabase';
import { downloadManager } from '@/services/downloadManager';
import { getPackageFiles, refreshPackageProgress, setPackageState, updateOfflineFile, type OfflineFileRow } from '@/services/offlineDatabase';
import type {
  BookDownloadManager,
  BookDownloadProgress,
  BookUpdateCheck,
  ContentPackagePayload,
  ContentResourceManifest,
  ContentRootManifest,
  DownloadableBookKey,
} from '@/types/bookDownloads';
import type { OfflineDownloadRequest } from '@/types/offlineDownloads';
import { forEachLimited, throttled } from '@/utils/concurrency';

const MANIFEST_BASE_URL = (process.env.EXPO_PUBLIC_CONTENT_PACKAGES_URL || '').replace(/\/+$/, '');
const MANIFEST_CACHE_MS = 60_000;
const AUTO_UPDATE_SETTING = 'automatic_book_updates_wifi';
// When the published manifest was last compared against the installed books,
// by hand or automatically: Downloads & Storage shows it under "Check for updates".
const LAST_UPDATE_CHECK_SETTING = 'last_book_update_check';
// How many of a book's resources are fetched and imported at once.
const RESOURCE_CONCURRENCY = 3;
// A book's progress is rewritten at most this often while its resources download.
const PROGRESS_INTERVAL_MS = 250;

class PausedDownloadError extends Error {}

/**
 * A resource being fetched and imported, shared by every book that needs it.
 * A pause from the last book still wanting it stops it between steps.
 */
type ResourceStaging = { stopped: boolean; promise: Promise<void> };

/** An installing book's pause: it stops the book at once, whatever its resources are doing. */
type BookRun = { paused: boolean; pause: () => void; interrupted: Promise<never> };

function bookRun(): BookRun {
  let reject: (error: Error) => void = () => undefined;
  const interrupted = new Promise<never>((_, fail) => { reject = fail; });
  interrupted.catch(() => { /* raced by installBook; a pause before then is not an error */ });
  const run: BookRun = { paused: false, pause: () => { run.paused = true; reject(new PausedDownloadError('Download paused.')); }, interrupted };
  return run;
}

function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (!MANIFEST_BASE_URL) throw new Error('Book package service is not configured.');
  return `${MANIFEST_BASE_URL}/${url.replace(/^\/+/, '')}`;
}

function packageKey(resource: ContentResourceManifest): string {
  return `book-resource:${resource.id}:${resource.version}`;
}

function resourceRequest(resource: ContentResourceManifest): OfflineDownloadRequest {
  return {
    packageKey: packageKey(resource),
    domain: 'books',
    entityType: 'book_resource',
    entityId: resource.id,
    locale: 'all',
    title: resource.id === 'calendar' ? 'Calendar' : resource.id.replaceAll('_', ' '),
    subtitle: resource.version,
    resources: resource.chunks.map((chunk) => ({
      // Content-addressing lets an unchanged chapter/chunk be linked into a
      // newer resource package without transferring it again.
      fileKey: `content:${resource.id}:${chunk.sha256}`,
      remoteUri: absoluteUrl(chunk.url),
      role: 'content',
      mimeType: 'application/json',
      fileSizeBytes: chunk.size,
      checksum: `sha256:${chunk.sha256}`,
      version: resource.version,
      extension: 'json',
    })),
    snapshots: [],
  };
}

async function invalidateDownloadedChunk(row: OfflineFileRow, key: string, message: string): Promise<never> {
  if (row.local_uri) {
    try { const file = new File(row.local_uri); if (file.exists) file.delete(); } catch { /* database state remains authoritative */ }
  }
  await updateOfflineFile(row.file_key, { localUri: null, status: 'failed', bytesWritten: 0, resumeJson: null, error: message });
  await setPackageState(key, 'failed', message);
  await refreshPackageProgress(key);
  throw new Error(message);
}

function resolvePublishedResources(manifest: ContentRootManifest, bookKey: DownloadableBookKey): string[] {
  const roots = new Set([...resourcesForBook(bookKey), ...manifest.books[bookKey].resources]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: string[] = [];
  const visit = (id: string) => {
    if (visited.has(id) || visiting.has(id)) return;
    const resource = manifest.resources[id];
    if (!resource) throw new Error(`Published book dependency ${id} is unavailable.`);
    visiting.add(id);
    for (const dependency of resource.dependencies || []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    ordered.push(id);
  };
  for (const root of roots) visit(root);
  return ordered;
}

async function waitForMediaPackage(key: string): Promise<void> {
  const current = await downloadManager.getProgress(key);
  if (current?.status === 'complete') return;
  if (current?.status === 'failed' || current?.status === 'cancelled') throw new Error(current.error || 'Package download failed.');
  if (current?.status === 'paused') throw new PausedDownloadError('Download paused.');
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const inspect = () => {
      void downloadManager.getProgress(key).then((progress) => {
        if (settled) return;
        if (progress?.status === 'complete') { settled = true; unsubscribe(); resolve(); }
        else if (progress?.status === 'paused') { settled = true; unsubscribe(); reject(new PausedDownloadError('Download paused.')); }
        else if (progress?.status === 'failed' || progress?.status === 'cancelled') {
          settled = true; unsubscribe(); reject(new Error(progress.error || 'Package download failed.'));
        }
      }).catch((error) => { settled = true; unsubscribe(); reject(error); });
    };
    const unsubscribe = downloadManager.subscribe(inspect);
    inspect();
  });
}

export async function getAutomaticBookUpdatesEnabled(): Promise<boolean> {
  return (await getContentSetting(AUTO_UPDATE_SETTING)) !== 'false';
}

export async function setAutomaticBookUpdatesEnabled(enabled: boolean): Promise<void> {
  await setContentSetting(AUTO_UPDATE_SETTING, enabled ? 'true' : 'false');
}

/** When the books were last checked for updates (ISO time), or null if never. */
export async function getLastBookUpdateCheck(): Promise<string | null> {
  return (await getContentSetting(LAST_UPDATE_CHECK_SETTING)) || null;
}

class NativeBookDownloadManager implements BookDownloadManager {
  private listeners = new Set<() => void>();
  private revision = 0;
  private manifestCache: { at: number; value: ContentRootManifest } | null = null;
  private manifestRequest: Promise<ContentRootManifest> | null = null;
  private bookWorkers = new Map<DownloadableBookKey, Promise<void>>();
  private bookRuns = new Map<DownloadableBookKey, BookRun>();
  private resourceWorkers = new Map<string, ResourceStaging>();
  private activeBookResources = new Map<DownloadableBookKey, ContentResourceManifest[]>();
  private initialized: Promise<void> | null = null;

  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getRevision = (): number => this.revision;
  private emit() { this.revision += 1; for (const listener of this.listeners) listener(); }
  // Every downloading book's progress is announced together, a few times a second.
  private announceProgress = throttled(async () => this.emit(), PROGRESS_INTERVAL_MS);
  private async cleanupActivatedVersions() {
    for (const resource of await listStoredResources()) {
      if (!resource.activeVersion) continue;
      const obsoletePackages = await getResourcePackageKeys(resource.resourceId, resource.activeVersion);
      await cleanupObsoleteResourceVersions(resource.resourceId);
      for (const oldPackage of obsoletePackages) await downloadManager.remove(oldPackage);
    }
  }
  private async initialize() {
    if (!this.initialized) {
      this.initialized = seedBookRows(DOWNLOADABLE_BOOK_KEYS.map((key) => ({ key, title: DOWNLOADABLE_BOOKS[key].title })))
        .then(() => this.cleanupActivatedVersions())
        .catch((error) => { this.initialized = null; throw error; });
    }
    await this.initialized;
  }

  private async fetchManifest(force = false): Promise<ContentRootManifest> {
    if (!force && this.manifestCache && Date.now() - this.manifestCache.at < MANIFEST_CACHE_MS) return this.manifestCache.value;
    if (!MANIFEST_BASE_URL) throw new Error('Set EXPO_PUBLIC_CONTENT_PACKAGES_URL to the Coptic Vine content package Worker.');
    // Books started together (Download All) share the one request in flight.
    this.manifestRequest ??= (async () => {
      const response = await fetch(`${MANIFEST_BASE_URL}/manifest.json`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Unable to check book packages (${response.status}).`);
      const manifest = await response.json() as ContentRootManifest;
      validatePublishedManifest(manifest);
      this.manifestCache = { at: Date.now(), value: manifest };
      return manifest;
    })().finally(() => { this.manifestRequest = null; });
    return this.manifestRequest;
  }

  private async stageResource(resource: ContentResourceManifest): Promise<void> {
    const key = `${resource.id}@${resource.version}`;
    const active = await getActiveResourceVersion(resource.id);
    if (active === resource.version) return;
    const running = this.resourceWorkers.get(key);
    if (running && !running.stopped) return running.promise;
    // One a pause has just stopped may still be winding down: this begins again once it has.
    if (running) { await running.promise.catch(() => undefined); return this.stageResource(resource); }
    const staging: ResourceStaging = { stopped: false, promise: Promise.resolve() };
    staging.promise = (async () => {
      await setResourceState(resource.id, active ? 'update_available' : 'downloading', { bytes: resource.size, error: null, systemOwned: resource.id === 'calendar' });
      this.emit();
      const request = resourceRequest(resource);
      await downloadManager.enqueue(request);
      // Stopped while its package was being queued: the pause came too soon to find it downloading.
      if (staging.stopped) { await downloadManager.pause(request.packageKey); throw new PausedDownloadError('Download paused.'); }
      await waitForMediaPackage(request.packageKey);
      const files = await getPackageFiles(request.packageKey);
      for (const chunk of resource.chunks) {
        if (staging.stopped) throw new PausedDownloadError('Download paused.');
        if (await isContentChunkImported(resource.id, resource.version, chunk.id)) continue;
        const row = files.find((file) => file.file_key === `content:${resource.id}:${chunk.sha256}`);
        if (!row?.local_uri) throw new Error(`Downloaded chunk ${chunk.id} is missing.`);
        let payload: ContentPackagePayload | null = null;
        try { payload = JSON.parse(await new File(row.local_uri).text()) as ContentPackagePayload; }
        catch { await invalidateDownloadedChunk(row, request.packageKey, `Package JSON is invalid for ${resource.id}/${chunk.id}.`); }
        if (!payload) {
          await invalidateDownloadedChunk(row, request.packageKey, `Package JSON is empty for ${resource.id}/${chunk.id}.`);
          throw new Error('Unreachable package validation state.');
        }
        if (payload.formatVersion !== 1 || payload.resourceId !== resource.id || payload.chunkId !== chunk.id) {
          await invalidateDownloadedChunk(row, request.packageKey, `Package identity check failed for ${resource.id}/${chunk.id}.`);
        }
        // The immutable payload is deliberately revision-neutral. Importing
        // it under the manifest's resource version enables cross-version
        // reuse while SQLite activation remains version-atomic.
        const versionedPayload = { ...payload, version: resource.version };
        try { await importContentChunk(versionedPayload, request.packageKey, chunk.rowCount); }
        catch { await invalidateDownloadedChunk(row, request.packageKey, `Package row count check failed for ${resource.id}/${chunk.id}.`); }
      }
      await setResourceState(resource.id, active ? 'update_available' : 'queued', { bytes: resource.size, error: null, systemOwned: resource.id === 'calendar' });
      this.emit();
    })().catch(async (cause) => {
      if (cause instanceof PausedDownloadError) {
        await setResourceState(resource.id, active ? 'update_available' : 'paused', { error: null, systemOwned: resource.id === 'calendar' });
      } else {
        await setResourceState(resource.id, active ? 'update_available' : 'failed', { error: cause instanceof Error ? cause.message : 'Package installation failed.', systemOwned: resource.id === 'calendar' });
      }
      this.emit();
      throw cause;
    }).finally(() => { if (this.resourceWorkers.get(key) === staging) this.resourceWorkers.delete(key); });
    this.resourceWorkers.set(key, staging);
    return staging.promise;
  }

  private async installBook(bookKey: DownloadableBookKey, run: BookRun): Promise<void> {
    await this.initialize();
    const previousBook = await getStoredBook(bookKey);
    const manifest = await this.fetchManifest(true);
    const resourceIds = resolvePublishedResources(manifest, bookKey);
    const resources = resourceIds.map((id) => manifest.resources[id]);
    this.activeBookResources.set(bookKey, resources);
    await setPendingBookResources(bookKey, resourceIds);
    const totalBytes = resources.reduce((sum, resource) => sum + resource.size, 0);
    await setBookState(bookKey, 'downloading', { progress: 0, bytesWritten: 0, totalBytes, error: null });
    this.emit();
    // The book's progress is its resources' together: a staged one whole, the
    // rest as far as their packages have got. It is rewritten as downloads
    // report, and stopped before the book's final state is written, so a late
    // report cannot land on top of it.
    const staged = new Set<string>();
    const report = throttled(async () => {
      const packages = new Map((await downloadManager.listDownloads()).map((item) => [item.packageKey, item]));
      const written = resources.reduce((sum, resource) => sum + (staged.has(resource.id)
        ? resource.size
        : resource.size * Math.max(0, Math.min(1, packages.get(packageKey(resource))?.progress ?? 0))), 0);
      await setBookState(bookKey, 'downloading', { progress: totalBytes ? written / totalBytes : 0, bytesWritten: Math.round(written), totalBytes });
      this.announceProgress.request();
    }, PROGRESS_INTERVAL_MS);
    const unsubscribe = downloadManager.subscribe(report.request);
    const stopReporting = async () => { unsubscribe(); await report.stop(); };
    try {
      // A few resources at a time, in dependency order; one another book is
      // already fetching is shared with it (stageResource). A pause stops the
      // book at once (pause), whatever its resources are still doing.
      await Promise.race([
        forEachLimited(resources, RESOURCE_CONCURRENCY, async (resource) => {
          await this.stageResource(resource);
          staged.add(resource.id);
          report.request();
        }, () => run.paused),
        run.interrupted,
      ]);
      await stopReporting();
      const graphOrphans = await activateBookResources(bookKey, resources.map((resource) => ({ id: resource.id, version: resource.version, bytes: resource.size })));
      for (const resource of resources) {
        const obsoletePackages = await getResourcePackageKeys(resource.id, resource.version);
        await cleanupObsoleteResourceVersions(resource.id);
        for (const oldPackage of obsoletePackages) await downloadManager.remove(oldPackage);
      }
      if (graphOrphans.length) {
        const downloads = await downloadManager.listDownloads();
        for (const item of downloads.filter((download) => download.domain === 'books' && graphOrphans.includes(download.entityId))) {
          await downloadManager.remove(item.packageKey);
        }
      }
      this.emit();
    } catch (cause) {
      await stopReporting();
      if (cause instanceof PausedDownloadError) await setBookState(bookKey, 'paused', { error: null });
      else await setBookState(bookKey, previousBook?.installedAt ? 'update_available' : 'failed', {
        error: cause instanceof Error ? cause.message : 'Book download failed.',
      });
      this.emit();
      throw cause;
    }
  }

  install(bookKey: DownloadableBookKey): Promise<void> {
    const existing = this.bookWorkers.get(bookKey);
    if (existing && !this.bookRuns.get(bookKey)?.paused) return existing;
    const run = bookRun();
    // A book just paused may still be stopping: it starts again once it has.
    const worker: Promise<void> = (existing ?? Promise.resolve()).catch(() => undefined)
      .then(() => this.installBook(bookKey, run))
      .finally(() => { if (this.bookWorkers.get(bookKey) === worker) { this.bookWorkers.delete(bookKey); this.bookRuns.delete(bookKey); } });
    this.bookWorkers.set(bookKey, worker);
    this.bookRuns.set(bookKey, run);
    return worker;
  }

  /**
   * Every book not yet downloaded, paused or failed, started together. The
   * resources they share (Public, the Bible, the calendar…) are fetched once
   * for all of them (stageResource). However many fail, one failure is
   * reported; a book paused meanwhile is not a failure.
   */
  async installAll(): Promise<void> {
    await this.initialize();
    const waiting = (await listStoredBooks()).filter((book) => ['not_downloaded', 'paused', 'failed'].includes(book.status));
    const results = await Promise.allSettled(waiting.map((book) => this.install(book.bookKey)));
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected' && !(result.reason instanceof PausedDownloadError));
    if (failure) throw failure.reason;
  }

  async pause(bookKey: DownloadableBookKey): Promise<void> {
    // The install this pause stops; a resume meanwhile starts another (install).
    const worker = this.bookWorkers.get(bookKey);
    this.bookRuns.get(bookKey)?.pause();
    // What another book still installing is waiting on keeps downloading for it.
    const needed = new Set<string>();
    for (const [other, resources] of this.activeBookResources) {
      if (other !== bookKey && this.bookRuns.has(other) && !this.bookRuns.get(other)?.paused) for (const resource of resources) needed.add(packageKey(resource));
    }
    // The rest stop, and are waited for, so that removing the book next finds
    // nothing of it still being written.
    const stopping: Promise<unknown>[] = [];
    for (const resource of this.activeBookResources.get(bookKey) || []) {
      if (needed.has(packageKey(resource))) continue;
      const staging = this.resourceWorkers.get(`${resource.id}@${resource.version}`);
      if (staging) { staging.stopped = true; stopping.push(staging.promise.catch(() => undefined)); }
      const progress = await downloadManager.getProgress(packageKey(resource));
      if (progress && ['queued', 'downloading'].includes(progress.status)) await downloadManager.pause(progress.packageKey);
    }
    await Promise.all(stopping);
    // An installing book records its own pause as it stops (installBook), unless it finished first.
    if (worker) await worker.catch(() => undefined);
    else if (['queued', 'downloading'].includes((await getStoredBook(bookKey))?.status ?? '')) await setBookState(bookKey, 'paused', { error: null });
    this.emit();
  }

  resume(bookKey: DownloadableBookKey): Promise<void> { return this.install(bookKey); }
  retry(bookKey: DownloadableBookKey): Promise<void> { return this.install(bookKey); }

  async remove(bookKey: DownloadableBookKey): Promise<void> {
    await this.pause(bookKey).catch(() => undefined);
    const worker = this.bookWorkers.get(bookKey);
    if (worker) try { await worker; } catch { /* paused/failed state is removed below */ }
    const orphaned = await removeBookReferences(bookKey);
    const downloads = await downloadManager.listDownloads();
    for (const resourceId of orphaned) {
      for (const item of downloads.filter((download) => download.domain === 'books' && download.entityId === resourceId)) {
        await downloadManager.remove(item.packageKey);
      }
    }
    this.activeBookResources.delete(bookKey);
    this.emit();
  }

  async ensureCalendar(): Promise<void> {
    await this.initialize();
    const manifest = await this.fetchManifest();
    const resource = manifest.resources.calendar;
    if (await getActiveResourceVersion('calendar') === resource.version) return;
    await this.stageResource(resource);
    await activateSystemResource('calendar', resource.version, resource.size);
    const obsoletePackages = await getResourcePackageKeys('calendar', resource.version);
    await cleanupObsoleteResourceVersions('calendar');
    for (const oldPackage of obsoletePackages) await downloadManager.remove(oldPackage);
    this.emit();
  }

  async checkForUpdates(manual = false): Promise<BookUpdateCheck> {
    await this.initialize();
    const manifest = await this.fetchManifest(true);
    const calendarActive = await getActiveResourceVersion('calendar');
    const calendar = Boolean(calendarActive) && calendarActive !== manifest.resources.calendar.version;
    const books = await listStoredBooks();
    const updates: DownloadableBookKey[] = [];
    for (const book of books.filter((item) => ['installed', 'update_available'].includes(item.status))) {
      const resourceIds = resolvePublishedResources(manifest, book.bookKey);
      const stale = (await Promise.all(resourceIds.map(async (id) => (await getActiveResourceVersion(id)) !== manifest.resources[id].version))).some(Boolean);
      if (stale) { await setBookState(book.bookKey, 'update_available'); updates.push(book.bookKey); }
    }
    await setContentSetting(LAST_UPDATE_CHECK_SETTING, new Date().toISOString());
    const network = await Network.getNetworkStateAsync();
    const wifi = network.isConnected !== false && [Network.NetworkStateType.WIFI, Network.NetworkStateType.ETHERNET].includes(network.type as any);
    const automatic = await getAutomaticBookUpdatesEnabled();
    const downloading = manual || (wifi && automatic);
    if (downloading) {
      // Started, not waited for: each book shows its own progress on
      // Downloads & Storage, and a failure stays on its own row.
      void this.ensureCalendar().catch(() => undefined);
      for (const bookKey of updates) void this.install(bookKey).catch(() => undefined);
    }
    this.emit();
    return { updates, calendar, downloading, publishedAt: manifest.publishedAt };
  }

  async listBooks(): Promise<BookDownloadProgress[]> { await this.initialize(); return listStoredBooks(); }
  async listResources() { await this.initialize(); return listStoredResources(); }
  async getBook(bookKey: DownloadableBookKey): Promise<BookDownloadProgress> {
    await this.initialize();
    return (await getStoredBook(bookKey)) || { bookKey, title: DOWNLOADABLE_BOOKS[bookKey].title,
      status: 'not_downloaded', progress: 0, bytesWritten: 0, totalBytes: null,
      error: null, installedAt: null, updatedAt: '' };
  }
}

export const bookDownloadManager: BookDownloadManager = new NativeBookDownloadManager();
