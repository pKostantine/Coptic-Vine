/**
 * Who may call each database function on Supabase, from the dump's
 * `grant execute` statements (schema/pg-user-schema.sql), as
 * schema/function-grants.json: { "<schema>.<function>": ["anon", "authenticated"] }.
 * The Worker refuses a call the role couldn't make there, with Postgres's
 * "permission denied for function" (src/rpc/index.ts).
 *
 *   node --experimental-strip-types scripts/gen-grants.ts [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);

export function functionGrants(dump: string): Record<string, string[]> {
  const grants: Record<string, Set<string>> = {};
  for (const match of dump.matchAll(/^grant execute on function ([a-z_]+)\.([a-z_0-9]+)\(.*\) to ([a-z_]+);$/gm)) {
    const key = `${match[1]}.${match[2]}`;
    (grants[key] ??= new Set()).add(match[3]);
  }
  return Object.fromEntries(Object.keys(grants).sort().map((key) => [key, [...grants[key]].sort()]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = `${JSON.stringify(functionGrants(readFileSync(new URL('schema/pg-user-schema.sql', root), 'utf8')), null, 1)}\n`;
  const path = new URL('schema/function-grants.json', root);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== text) {
      console.error('schema/function-grants.json is out of date with schema/pg-user-schema.sql. Run npm run gen:grants.');
      process.exit(1);
    }
    console.log('Function grants are up to date.');
  } else {
    writeFileSync(path, text);
    console.log(`${Object.keys(JSON.parse(text)).length} functions written to schema/function-grants.json.`);
  }
}
