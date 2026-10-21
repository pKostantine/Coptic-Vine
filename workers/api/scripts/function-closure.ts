/**
 * For porting: the functions a set of Supabase functions call, all the way
 * down, from the dump (schema/pg-user-schema.sql), with their sizes, the
 * tables they read and write, and whether they're already ported.
 *
 *   npm run closure -- get_music_home set_track_liked …        the list
 *   npm run closure -- --print get_music_home                   the definitions too
 */
import { readFileSync } from 'node:fs';
import { RPCS } from '../src/rpc/index.ts';

const dump = readFileSync(new URL('../schema/pg-user-schema.sql', import.meta.url), 'utf8');
const definitions = new Map<string, string>();
for (const statement of dump.split('\n--;;\n')) {
  const match = statement.match(/^CREATE OR REPLACE FUNCTION ([a-z_]+)\.([a-z_0-9]+)\(/m);
  if (match) {
    const key = `${match[1]}.${match[2]}`;
    definitions.set(key, (definitions.has(key) ? `${definitions.get(key)}\n\n` : '') + statement);
  }
}

const ported = new Set(Object.entries(RPCS).flatMap(([schema, fns]) => Object.keys(fns).map((name) => `${schema}.${name}`)));

function calls(body: string): string[] {
  const out = new Set<string>();
  for (const match of body.matchAll(/\b(public|private|creator|learning|media|music)\.([a-z_0-9]+)\s*\(/g)) {
    const key = `${match[1]}.${match[2]}`;
    if (definitions.has(key)) out.add(key);
  }
  return [...out];
}

function tables(body: string): { reads: string[]; writes: string[] } {
  const writes = new Set<string>();
  for (const match of body.matchAll(/\b(?:insert\s+into|update|delete\s+from)\s+(public|private|creator|learning|media|music)\.([a-z_0-9]+)/gi)) writes.add(`${match[1]}.${match[2]}`);
  const reads = new Set<string>();
  for (const match of body.matchAll(/\b(?:from|join)\s+(public|private|creator|learning|media|music)\.([a-z_0-9]+)\b(?!\s*\()/gi)) reads.add(`${match[1]}.${match[2]}`);
  return { reads: [...reads].sort(), writes: [...writes].sort() };
}

const args = process.argv.slice(2);
const print = args.includes('--print');
const roots = args.filter((arg) => !arg.startsWith('--')).map((name) => (name.includes('.') ? name : `public.${name}`));
const seen = new Map<string, number>();
const queue: [string, number][] = roots.map((root) => [root, 0]);
while (queue.length) {
  const [name, depth] = queue.shift()!;
  if (seen.has(name)) continue;
  if (!definitions.has(name)) { console.log(`?? ${name} is not in the dump`); continue; }
  seen.set(name, depth);
  for (const callee of calls(definitions.get(name)!)) if (callee !== name) queue.push([callee, depth + 1]);
}
let total = 0;
for (const [name, depth] of [...seen].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) {
  const body = definitions.get(name)!;
  total += body.length;
  const { reads, writes } = tables(body);
  const definer = /SECURITY DEFINER/.test(body) ? 'definer' : 'invoker';
  const language = body.match(/LANGUAGE (\w+)/)?.[1];
  console.log(`${'  '.repeat(depth)}${ported.has(name) ? '[ported] ' : ''}${name}  ${body.length} chars, ${language}, ${definer}${writes.length ? `, writes ${writes.join(' ')}` : ''}`);
  if (print) console.log(`\n${body}\n`);
}
console.log(`${seen.size} functions, ${total} characters; reads ${[...new Set([...seen.keys()].flatMap((name) => tables(definitions.get(name)!).reads))].length} tables.`);
