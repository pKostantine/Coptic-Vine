/**
 * Every D1 table name is "schema.table" in double quotes (docs/coptic-vine-d1-plan.md,
 * decision 2). This reads every string in the Worker's code and scripts and
 * fails on a user-data or sign-in table named without its quotes, as the
 * content Worker's test does for content tables.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stringContents } from '../../content-api/tests/sqlNames.test.ts';
import { userSchema } from '../scripts/lib/schema.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const relations = new Set([
  ...userSchema.tables.map((table) => `${table.schema}.${table.table}`),
  'auth.users', 'auth.sessions', 'auth.accounts', 'auth.verifications', 'auth.rate_limits',
]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name === '.wrangler' ? [] : files(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

test('no string in the Worker or its scripts names a table without its quotes', () => {
  const problems: string[] = [];
  for (const file of [...files(join(root, 'src')), ...files(join(root, 'scripts'))]) {
    for (const text of stringContents(readFileSync(file, 'utf8'))) {
      for (const match of text.matchAll(/(^|[^"\w])([a-z_]+\.[a-z_]+)(?!["\w])/g)) {
        if (relations.has(match[2])) problems.push(`${relative(root, file)}: ${match[2]} in "${text.slice(0, 80)}"`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
