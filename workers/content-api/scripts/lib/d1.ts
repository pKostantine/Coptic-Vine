import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type Target = 'remote' | 'local';

const workerDir = fileURLToPath(new URL('../..', import.meta.url));
const DATABASE = 'copticvine';

function wrangler(args: string[], capture: boolean): string {
  const result = spawnSync('npx', ['wrangler', 'd1', 'execute', DATABASE, ...args], {
    cwd: workerDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0) throw new Error(`wrangler d1 execute failed (${result.status}): ${(result.stderr || result.stdout || '').slice(-2000)}`);
  return result.stdout ?? '';
}

/** Runs a SQL file against D1 (remote through D1's import API). */
export function executeFile(target: Target, path: string): void {
  wrangler([`--${target}`, '--file', path, '--yes'], false);
}

/** Each statement's rows, for one or more read statements separated by semicolons. */
export function queryAll<T = Record<string, unknown>>(target: Target, sql: string): T[][] {
  const output = wrangler([`--${target}`, '--json', '--command', sql], true);
  const parsed = JSON.parse(output.slice(output.indexOf('[')));
  if (!Array.isArray(parsed) || parsed.some((result) => !result.success)) throw new Error(`D1 query failed: ${sql.slice(0, 200)}`);
  return parsed.map((result) => result.results as T[]);
}

/** One read query's rows. */
export function query<T = Record<string, unknown>>(target: Target, sql: string): T[] {
  const results = queryAll<T>(target, sql);
  return results[results.length - 1];
}
