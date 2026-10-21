/**
 * The cutover's storage step (docs/d1/phase2-runbook.md): the objects of
 * Supabase Storage's two buckets, profile-avatars and playlist-covers, copied
 * to R2 (cv-user-media, keyed "<bucket>/<path>", src/storage.ts), and the
 * addresses D1 holds for them rewritten to cv-api's: users' photos
 * ("auth.users".image and raw_user_meta_data.chc_avatar_url) and uploaded
 * playlist covers ("media.media_assets" path, external, playlist-covers).
 * Run it after the import has been verified (the rewrite changes what the
 * checksums compare). Supabase is only read: the objects are public.
 *
 *   npm run move-storage -- --dry-run        list what would be copied and rewritten
 *   npm run move-storage                     copy to R2 and rewrite the remote D1
 *   npm run move-storage -- --local          against the local D1 and R2 (wrangler dev)
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { col, t } from '../../content-api/src/db/names.ts';
import { executeFile, query, type Target } from '../../content-api/scripts/lib/d1.ts';

export const R2_BUCKET = 'cv-user-media';
const SUPABASE_OBJECT = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/(profile-avatars|playlist-covers)\/([^?#]+)(\?[^#]*)?$/;

export type Copy = { from: string; key: string };
export type Plan = { copies: Copy[]; sql: string[] };

const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** What to copy and how to rewrite, from the rows D1 holds; the API's address is cv-api's (https://api.copticvine.ca). */
export function storagePlan(users: { id: string; image: string | null; raw_user_meta_data: string }[], covers: { id: string; path: string }[], api: string): Plan {
  const copies = new Map<string, Copy>();
  /** The address on cv-api for a Supabase Storage one (its query kept), or null for anything else. */
  const moved = (url: string | null): string | null => {
    const match = url == null ? null : SUPABASE_OBJECT.exec(url);
    if (!match) return null;
    const [, bucket, path, search = ''] = match;
    const key = `${bucket}/${decodeURIComponent(path)}`;
    copies.set(key, { from: url!.replace(/[?#].*$/, ''), key });
    return `${api.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${path}${search}`;
  };
  const sql: string[] = [];
  for (const user of users) {
    const meta = JSON.parse(user.raw_user_meta_data) as Record<string, unknown>;
    const image = moved(user.image);
    const avatar = typeof meta.chc_avatar_url === 'string' ? moved(meta.chc_avatar_url) : null;
    const set = [];
    if (image) set.push(`${col('image')} = ${quote(image)}`);
    if (avatar) set.push(`${col('raw_user_meta_data')} = json_set(${col('raw_user_meta_data')}, '$.chc_avatar_url', ${quote(avatar)})`);
    if (set.length) sql.push(`UPDATE ${t('auth', 'users')} SET ${set.join(', ')} WHERE ${col('id')} = ${quote(user.id)};`);
  }
  for (const cover of covers) {
    const path = moved(cover.path);
    if (path) sql.push(`UPDATE ${t('media', 'media_assets')} SET ${col('path')} = ${quote(path)} WHERE ${col('id')} = ${quote(cover.id)};`);
  }
  return { copies: [...copies.values()], sql };
}

/** Whether Supabase's answer says the object isn't there. */
export function missingObject(status: number, answer: string): boolean {
  if (status === 404) return true;
  try {
    return status === 400 && (JSON.parse(answer) as { statusCode?: unknown }).statusCode === '404';
  } catch {
    return false;
  }
}

function r2Put(target: Target, key: string, file: string, contentType: string): void {
  const result = spawnSync('npx', ['wrangler', 'r2', 'object', 'put', `${R2_BUCKET}/${key}`, '--file', file, '--content-type', contentType, `--${target}`], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) throw new Error(`wrangler r2 object put ${key} failed: ${(result.stderr || result.stdout).slice(-1000)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const target: Target = args.includes('--local') ? 'local' : 'remote';
  const dryRun = args.includes('--dry-run');
  const users = query<{ id: string; image: string | null; raw_user_meta_data: string }>(target,
    `SELECT ${col('id')} AS id, ${col('image')} AS image, ${col('raw_user_meta_data')} AS raw_user_meta_data FROM ${t('auth', 'users')}`);
  const covers = query<{ id: string; path: string }>(target,
    `SELECT ${col('id')} AS id, ${col('path')} AS path FROM ${t('media', 'media_assets')} WHERE ${col('provider')} = 'external' AND ${col('bucket')} = 'playlist-covers'`);
  const plan = storagePlan(users, covers, process.env.CV_API_URL ?? 'https://api.copticvine.ca');
  console.log(`${plan.copies.length} objects to copy, ${plan.sql.length} rows to rewrite.`);
  for (const copy of plan.copies) console.log(`  ${copy.from} -> r2://${R2_BUCKET}/${copy.key}`);
  if (dryRun) process.exit(0);
  const dir = mkdtempSync(join(tmpdir(), 'cv-storage-'));
  try {
    for (const copy of plan.copies) {
      const response = await fetch(copy.from);
      if (!response.ok) {
        const answer = await response.text();
        // Gone from Supabase already (a cleared playlist cover keeps its archived row): nothing to
        // copy, and its address is still rewritten, to answer the same 404 from cv-api. Supabase
        // answers a missing object with a 400 whose statusCode is "404".
        if (!missingObject(response.status, answer)) throw new Error(`${copy.from}: ${response.status} ${answer.slice(0, 200)}`);
        console.warn(`  missing on Supabase, not copied: ${copy.from}`);
        continue;
      }
      const file = join(dir, 'object');
      writeFileSync(file, new Uint8Array(await response.arrayBuffer()));
      r2Put(target, copy.key, file, response.headers.get('content-type') ?? 'application/octet-stream');
    }
    if (plan.sql.length) {
      const file = join(dir, 'rewrite.sql');
      writeFileSync(file, `${plan.sql.join('\n')}\n`);
      executeFile(target, file);
    }
    console.log('Copied and rewritten.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
