import { Directory, DownloadTask, File, Paths, type DownloadPauseState, type DownloadProgress, type DownloadTaskOptions } from 'expo-file-system';

import { DOWNLOADS_FOLDER, findEntityDownloads, findPlayableHolders, findPlayableLocalUri, getDownloadProgress, getOfflineFile, getPackageFiles, getStoredDownloadRequest, isEntityDownloaded, refreshPackageProgress, removeOfflinePackage, saveDownloadRequest, setPackageProgress, setPackageState, updateOfflineFile, type OfflineFileRow } from '@/services/offlineDatabase';
import { assertDownloadNetworkAllowed } from '@/services/downloadPreferences';
import { cleanupIncompleteDownloads, getDownloadStorageSummary, isDownloadRequestStale, listDownloads, removeAllDownloadRecords, validateDownloadedFiles } from '@/services/downloadStorageManager';
import type { OfflineDownloadManager, OfflineDownloadProgress, OfflineDownloadRequest, OfflineDownloadResource } from '@/types/offlineDownloads';
import type { PlaybackEntityKind } from '@/types/playback';
import { forEachLimited, throttled } from '@/utils/concurrency';

const DOWNLOAD_DIRECTORY = new Directory(Paths.document, DOWNLOADS_FOLDER, 'files');
// How many of a package's files are fetched at once. A book resource is many
// small chunks, and fetched one by one each paid a whole round trip.
const FILE_CONCURRENCY = 6;
/**
 * A transfer that fails is tried again after each of these before its
 * package fails: a dropped connection, or a book chunk's foreground transfer
 * cut off while the app was put away, no longer fails a whole book's update
 * for one chunk in a hundred.
 */
const TRANSFER_RETRY_DELAYS_MS = [1000, 4000];
// Progress is saved and announced at most this often while files download:
// each announcement re-reads the Downloads page and every book waiting on it.
const PROGRESS_INTERVAL_MS = 250;

/** One pass of a package's worker: the transfers it has in flight and how far each file has got. */
type PackageRun = {
  /** Set by pause, cancel and remove: no further file starts, and the pass ends without marking the package complete. */
  stopped: boolean;
  transfers: Map<string, DownloadTask>;
  bytes: Map<string, number>;
  sizes: Map<string, number | null>;
  complete: Set<string>;
  report: ReturnType<typeof throttled>;
  /** Settles once the pass has ended and recorded where each file got to; never rejects. */
  done: Promise<void>;
};

function sanitizeFilePart(value: string): string { return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'media'; }
function inferExtension(resource: OfflineDownloadResource): string {
  if (resource.extension) return (resource.extension.startsWith('.') ? resource.extension : `.${resource.extension}`).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
  const mime = resource.mimeType?.toLowerCase() ?? '';
  if (mime.includes('mpeg')) return '.mp3'; if (mime.includes('mp4')) return '.mp4'; if (mime.includes('m4a') || mime.includes('aac')) return '.m4a';
  if (mime.includes('wav')) return '.wav'; if (mime.includes('webm')) return '.webm'; if (mime.includes('jpeg')) return '.jpg'; if (mime.includes('png')) return '.png'; if (mime.includes('webp')) return '.webp';
  if (mime.includes('json')) return '.json';
  try { const match = new URL(resource.remoteUri).pathname.match(/\.[a-zA-Z0-9]{1,8}$/); if (match) return match[0].toLowerCase(); } catch { /* extension is optional */ }
  return resource.role === 'artwork' ? '.img' : resource.role === 'content' ? '.json' : '.media';
}
function destinationFor(resource: OfflineDownloadResource): File { DOWNLOAD_DIRECTORY.create({ idempotent: true, intermediates: true }); return new File(DOWNLOAD_DIRECTORY, `${sanitizeFilePart(resource.fileKey)}${inferExtension(resource)}`); }
function isUsableLocalFile(uri: string | null, expectedSize?: number | null): boolean { if (!uri) return false; try { const file = new File(uri); return file.exists && file.size > 0 && (expectedSize == null || expectedSize <= 0 || file.size === expectedSize); } catch { return false; } }
function hasVideo(request: OfflineDownloadRequest): boolean { return request.resources.some((item) => item.playableKind === 'learning_video_audio' || item.mimeType?.toLowerCase().startsWith('video/')); }
function checksumSpec(value?: string | null): { algorithm: 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'; digest: string } | null {
  if (!value) return null; const digest = value.trim().toLowerCase().replace(/^sha(?:-|_)?256:/, '').replace(/^md5:/, '');
  if (/^[a-f0-9]{32}$/.test(digest)) return { algorithm: 'MD5', digest }; if (/^[a-f0-9]{40}$/.test(digest)) return { algorithm: 'SHA-1', digest };
  if (/^[a-f0-9]{64}$/.test(digest)) return { algorithm: 'SHA-256', digest }; if (/^[a-f0-9]{96}$/.test(digest)) return { algorithm: 'SHA-384', digest };
  if (/^[a-f0-9]{128}$/.test(digest)) return { algorithm: 'SHA-512', digest }; return null;
}

/** The liturgical calendar, which the app keeps installed itself: downloaded on any connection. */
function isSystemResource(request: OfflineDownloadRequest): boolean { return request.domain === 'books' && request.entityId === 'calendar'; }

/**
 * Book content is many small JSON chunks, fetched on a foreground session,
 * which starts each one at once; iOS hands background transfers to a system
 * daemon that is slow to begin every one. Music and lessons are large files,
 * worth letting finish after the app is put away.
 */
function sessionTypeFor(request: OfflineDownloadRequest, resource: OfflineDownloadResource): NonNullable<DownloadTaskOptions['sessionType']> {
  return request.domain === 'books' || resource.role === 'content' ? 'foreground' : 'background';
}

/** A run's progress from its tally, as refreshPackageProgress works it out from the files. */
function runProgress(run: PackageRun): { progress: number; bytesWritten: number; totalBytes: number | null } {
  let bytesWritten = 0;
  let knownTotal = 0;
  let allTotalsKnown = run.sizes.size > 0;
  for (const [fileKey, size] of run.sizes) {
    bytesWritten += run.bytes.get(fileKey) ?? 0;
    if (size == null || size < 0) allTotalsKnown = false; else knownTotal += size;
  }
  const progress = run.sizes.size === 0 ? 1 : allTotalsKnown && knownTotal > 0 ? Math.min(1, bytesWritten / knownTotal) : run.complete.size / run.sizes.size;
  return { progress, bytesWritten, totalBytes: allTotalsKnown ? knownTotal : null };
}

class NativeDownloadManager implements OfflineDownloadManager {
  private listeners = new Set<() => void>(); private revision = 0;
  /** The pass under way for each package. */
  private runs = new Map<string, PackageRun>();
  /**
   * Each file being fetched, whichever download is fetching it: a track
   * several downloads hold (its album, a playlist) is one file, fetched
   * once. Another download needing it meanwhile waits for it.
   */
  private fileTransfers = new Map<string, Promise<void>>();
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getRevision = (): number => this.revision;
  private emit(): void { this.revision += 1; for (const listener of this.listeners) listener(); }
  // Progress from every package downloading is announced together, a few times a second.
  private announceProgress = throttled(async () => this.emit(), PROGRESS_INTERVAL_MS);
  private async waitForWorker(packageKey: string): Promise<void> { await this.runs.get(packageKey)?.done; }

  async enqueue(request: OfflineDownloadRequest): Promise<void> {
    await assertDownloadNetworkAllowed(hasVideo(request), isSystemResource(request));
    const current = await getDownloadProgress(request.packageKey);
    if (current?.status === 'complete' && await isDownloadRequestStale(request)) { await this.update(request); return; }
    await saveDownloadRequest(request);
    if ((await getDownloadProgress(request.packageKey))?.status === 'complete') { this.emit(); return; }
    await setPackageState(request.packageKey, 'queued'); this.emit(); this.startWorker(request.packageKey);
  }
  async update(request: OfflineDownloadRequest): Promise<void> { await assertDownloadNetworkAllowed(hasVideo(request), isSystemResource(request)); await this.remove(request.packageKey); await saveDownloadRequest(request); await setPackageState(request.packageKey, 'queued'); this.emit(); this.startWorker(request.packageKey); }
  checkForUpdate(request: OfflineDownloadRequest): Promise<boolean> { return isDownloadRequestStale(request); }
  async pause(packageKey: string): Promise<void> {
    const run = this.runs.get(packageKey); if (run) run.stopped = true;
    await setPackageState(packageKey, 'paused');
    // Every transfer in flight pauses, and each keeps its own resume point (see downloadFile).
    if (run) { await Promise.all([...run.transfers.values()].map((task) => task.pauseAsync().catch(() => { /* it finished or failed as it was paused */ }))); await run.done; }
    await refreshPackageProgress(packageKey); this.emit();
  }
  async resume(packageKey: string): Promise<void> { const request = await getStoredDownloadRequest(packageKey); if (!request) throw new Error('This download is no longer available to resume.'); await assertDownloadNetworkAllowed(hasVideo(request), isSystemResource(request)); await this.waitForWorker(packageKey); await setPackageState(packageKey, 'queued'); this.emit(); this.startWorker(packageKey); }
  async cancel(packageKey: string): Promise<void> {
    const run = this.runs.get(packageKey); if (run) run.stopped = true;
    await setPackageState(packageKey, 'cancelled');
    if (run) { for (const task of run.transfers.values()) task.cancel(); await run.done; }
    await refreshPackageProgress(packageKey); this.emit();
  }
  async retry(packageKey: string): Promise<void> { const request = await getStoredDownloadRequest(packageKey); if (!request) throw new Error('This download is no longer available to retry.'); await assertDownloadNetworkAllowed(hasVideo(request), isSystemResource(request)); await this.waitForWorker(packageKey); for (const file of await getPackageFiles(packageKey)) if (file.status === 'failed' || file.status === 'cancelled') await updateOfflineFile(file.file_key, { status: 'queued', error: null, resumeJson: null }); await setPackageState(packageKey, 'queued'); this.emit(); this.startWorker(packageKey); }
  async remove(packageKey: string): Promise<void> {
    const run = this.runs.get(packageKey);
    if (run) { run.stopped = true; for (const task of run.transfers.values()) task.cancel(); await run.done; }
    for (const row of await removeOfflinePackage(packageKey)) if (row.local_uri) try { const file = new File(row.local_uri); if (file.exists) file.delete(); } catch { /* database removal is authoritative */ }
    this.emit();
  }
  async removeAll(): Promise<void> { for (const uri of await removeAllDownloadRecords()) try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* database removal is authoritative */ } this.emit(); }
  async cleanupIncomplete(): Promise<number> { const count = await cleanupIncompleteDownloads(); this.emit(); return count; }
  async validateIntegrity() { const result = await validateDownloadedFiles(); this.emit(); return result; }
  getStorageSummary() { return getDownloadStorageSummary(); }
  listDownloads() { return listDownloads(); }
  getProgress(packageKey: string): Promise<OfflineDownloadProgress | null> { return getDownloadProgress(packageKey); }
  isDownloaded(entityType: OfflineDownloadRequest['entityType'], entityId: string): Promise<boolean> { return isEntityDownloaded(entityType, entityId); }
  holdersOf(playableKind: PlaybackEntityKind, playableId: string) { return findPlayableHolders(playableKind, playableId); }
  downloadsOf(entityType: OfflineDownloadRequest['entityType'], entityId: string) { return findEntityDownloads(entityType, entityId); }
  async resolvePlaybackUri(playableKind: PlaybackEntityKind, playableId: string, remoteUri?: string | null): Promise<string | null> { const localUri = await findPlayableLocalUri(playableKind, playableId); return localUri && isUsableLocalFile(localUri) ? localUri : remoteUri?.trim() || null; }

  private startWorker(packageKey: string): void {
    const current = this.runs.get(packageKey);
    if (current && !current.stopped) return;
    const run: PackageRun = {
      stopped: false, transfers: new Map(), bytes: new Map(), sizes: new Map(), complete: new Set(),
      report: throttled(async () => {
        if (run.stopped) return;
        const { progress, bytesWritten, totalBytes } = runProgress(run);
        await setPackageProgress(packageKey, progress, bytesWritten, totalBytes);
        this.announceProgress.request();
      }, PROGRESS_INTERVAL_MS),
      done: Promise.resolve(),
    };
    // A pass just paused or cancelled may still be recording where its files
    // got to; this one starts from there once it has.
    run.done = (current?.done ?? Promise.resolve())
      .then(() => (run.stopped ? undefined : this.processPackage(packageKey, run)))
      .catch(async (cause) => { if (run.stopped) return; await setPackageState(packageKey, 'failed', cause instanceof Error ? cause.message : 'Download failed.'); await refreshPackageProgress(packageKey); this.emit(); })
      .catch(() => { /* the failure could not be recorded; the package stays as it was */ })
      .finally(() => { if (this.runs.get(packageKey) === run) this.runs.delete(packageKey); });
    this.runs.set(packageKey, run);
  }
  private async processPackage(packageKey: string, run: PackageRun): Promise<void> {
    const request = await getStoredDownloadRequest(packageKey); if (!request) throw new Error('Download metadata is missing.');
    if (run.stopped) return; // paused or cancelled as it began: keep the state the pause wrote
    await setPackageState(packageKey, 'downloading'); this.emit();
    const resources = new Map(request.resources.map((resource) => [resource.fileKey, resource]));
    // The package's files are read once; from here its progress is tallied as
    // they arrive rather than re-read from every file after each one.
    const waiting: OfflineFileRow[] = [];
    for (const row of await getPackageFiles(packageKey)) {
      const usable = row.status === 'complete' && isUsableLocalFile(row.local_uri, row.file_size_bytes);
      run.sizes.set(row.file_key, row.file_size_bytes ?? row.total_bytes);
      run.bytes.set(row.file_key, usable || row.resume_json ? Math.max(0, row.bytes_written) : 0);
      if (usable) run.complete.add(row.file_key); else waiting.push(row);
    }
    try {
      await forEachLimited(waiting, FILE_CONCURRENCY, async (row) => {
        const resource = resources.get(row.file_key); if (!resource) throw new Error(`Missing resource metadata for ${row.file_key}.`);
        await this.fetchFileOnce(run, row, resource, sessionTypeFor(request, resource));
      }, () => run.stopped);
    } finally { await run.report.stop(); }
    if (run.stopped) return;
    await setPackageState(packageKey, 'complete'); await refreshPackageProgress(packageKey); this.emit();
    if (request.entityType === 'music_release') await this.absorbTrackDownloads(request);
  }
  /**
   * A release saved whole holds each of its tracks, so a track downloaded on
   * its own before is now the release's: its own download goes (its file
   * stays, held by the release), and the release is all that is listed.
   */
  private async absorbTrackDownloads(request: OfflineDownloadRequest): Promise<void> {
    const trackIds = new Set(request.resources.filter((resource) => resource.role === 'media' && resource.playableKind === 'music_track' && resource.playableId).map((resource) => resource.playableId as string));
    for (const trackId of trackIds) {
      for (const holder of await findPlayableHolders('music_track', trackId)) {
        if (holder.packageKey !== request.packageKey && holder.entityType === 'music_track' && holder.entityId === trackId) await this.remove(holder.packageKey);
      }
    }
  }
  /**
   * Fetches a file this download needs, once on the device whatever holds
   * it: while another download is fetching it, this one waits; then, the
   * file claimed before anything else can look, it is read afresh, and one
   * another download has saved meanwhile is counted, not fetched again.
   */
  private async fetchFileOnce(run: PackageRun, row: OfflineFileRow, resource: OfflineDownloadResource, sessionType: NonNullable<DownloadTaskOptions['sessionType']>): Promise<void> {
    const fileKey = row.file_key;
    for (let elsewhere = this.fileTransfers.get(fileKey); elsewhere; elsewhere = this.fileTransfers.get(fileKey)) {
      await elsewhere;
      if (run.stopped) return;
    }
    // Nothing between the look above and this claim: no other download can
    // take the file up in between.
    let release = () => {};
    const claim = new Promise<void>((resolve) => { release = resolve; });
    this.fileTransfers.set(fileKey, claim);
    try {
      const current = (await getOfflineFile(fileKey)) ?? row;
      if (current.status === 'complete' && isUsableLocalFile(current.local_uri, current.file_size_bytes)) {
        run.sizes.set(fileKey, current.file_size_bytes ?? current.bytes_written); run.bytes.set(fileKey, current.bytes_written); run.complete.add(fileKey); run.report.request();
        return;
      }
      if (run.stopped) return;
      if (current.status === 'complete') await updateOfflineFile(fileKey, { localUri: null, status: 'queued', bytesWritten: 0, resumeJson: null });
      await this.downloadFileWithRetries(run, current.status === 'complete' ? { ...current, status: 'queued', local_uri: null, bytes_written: 0, resume_json: null } : current, resource, sessionType);
    } finally {
      if (this.fileTransfers.get(fileKey) === claim) this.fileTransfers.delete(fileKey);
      release();
    }
  }
  private async downloadFileWithRetries(run: PackageRun, row: OfflineFileRow, resource: OfflineDownloadResource, sessionType: NonNullable<DownloadTaskOptions['sessionType']>): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try { await this.downloadFile(run, row, resource, sessionType); return; }
      catch (cause) {
        const delay = TRANSFER_RETRY_DELAYS_MS[attempt];
        if (run.stopped || delay === undefined) throw cause;
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Paused or cancelled meanwhile: that records the state, as for a transfer in flight.
        if (run.stopped) return;
        // downloadFile recorded the failure; the next try starts the file afresh.
        row = { ...row, status: 'failed', bytes_written: 0, resume_json: null };
      }
    }
  }
  private async downloadFile(run: PackageRun, row: OfflineFileRow, resource: OfflineDownloadResource, sessionType: NonNullable<DownloadTaskOptions['sessionType']>): Promise<void> {
    const destination = destinationFor(resource); if (destination.exists && row.status !== 'paused') try { destination.delete(); } catch { /* transfer will report failure */ }
    const publishedSize = resource.fileSizeBytes != null && resource.fileSizeBytes > 0 ? resource.fileSizeBytes : null;
    const onProgress = (progress: DownloadProgress) => {
      const size = publishedSize ?? (progress.totalBytes >= 0 ? progress.totalBytes : null);
      if (size != null) run.sizes.set(row.file_key, size);
      run.bytes.set(row.file_key, Math.max(0, size == null ? progress.bytesWritten : Math.min(size, progress.bytesWritten)));
      run.report.request();
    };
    const options: DownloadTaskOptions = { headers: resource.headers ?? undefined, onProgress, sessionType };
    let task: DownloadTask | null = null;
    if (row.resume_json) try { task = DownloadTask.fromSavable(JSON.parse(row.resume_json) as DownloadPauseState, options); } catch { if (destination.exists) try { destination.delete(); } catch { /* noop */ } }
    task ??= File.createDownloadTask(resource.remoteUri, destination, options);
    // Nothing may come between this look at `stopped` and the transfer
    // starting, or a pause in between would miss the transfer.
    if (run.stopped) { if (task.state !== 'paused') try { task.release(); } catch { /* never started */ } return; }
    run.transfers.set(row.file_key, task);
    const transfer = task.state === 'paused' ? task.resumeAsync() : task.downloadAsync();
    try {
      const downloaded = await transfer;
      // Paused: keep where it got to, so resuming carries on from there.
      if (!downloaded) { if (task.state === 'paused') await updateOfflineFile(row.file_key, { status: 'paused', resumeJson: JSON.stringify(task.savable()), bytesWritten: run.bytes.get(row.file_key) ?? 0 }); return; }
      if (resource.fileSizeBytes != null && resource.fileSizeBytes > 0 && downloaded.size !== resource.fileSizeBytes) throw new Error('Downloaded file size does not match the published media.');
      const checksum = checksumSpec(resource.checksum); if (checksum && (await new File(downloaded.uri).digest(checksum.algorithm)).toLowerCase() !== checksum.digest) throw new Error('Downloaded file checksum does not match the published media.');
      await updateOfflineFile(row.file_key, { localUri: downloaded.uri, status: 'complete', bytesWritten: downloaded.size, totalBytes: downloaded.size, resumeJson: null, error: null });
      run.sizes.set(row.file_key, downloaded.size); run.bytes.set(row.file_key, downloaded.size); run.complete.add(row.file_key); run.report.request();
    } catch (cause) {
      if (run.stopped) { if (task.state === 'cancelled') await updateOfflineFile(row.file_key, { status: 'cancelled', resumeJson: null }); return; }
      const message = cause instanceof Error ? cause.message : 'Unable to download media.'; await updateOfflineFile(row.file_key, { status: 'failed', error: message, resumeJson: null }); throw cause;
    } finally { run.transfers.delete(row.file_key); if (task.state !== 'paused') try { task.release(); } catch { /* native runtime may already release */ } }
  }
}
export const downloadManager: OfflineDownloadManager = new NativeDownloadManager();

/** A download's saved cover and how many tracks or recordings it holds, for listing it (Downloads & Storage). */
export async function getDownloadPackageDetails(packageKey: string): Promise<{ artworkUri: string | null; mediaCount: number }> {
  const files = await getPackageFiles(packageKey);
  const artwork = files.find((file) => file.role === 'artwork' && file.local_uri);
  return { artworkUri: artwork?.local_uri ?? null, mediaCount: files.filter((file) => file.role === 'media').length };
}
