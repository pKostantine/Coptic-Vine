/**
 * Supabase's database functions as the RPC router needs them, from the dump
 * (schema/pg-user-schema.sql), as schema/functions.json:
 *
 *   { "<schema>.<function>": { "roles": ["anon", "authenticated"], "returns": "jsonb",
 *       "params": [{ "name": "p_locale", "type": "text", "default": "en" }] } }
 *
 * roles: who may call it (Supabase's EXECUTE grants); the router refuses
 *   anyone else with Postgres's "permission denied for function".
 * params: names, types and defaults, so a call is matched as PostgREST
 *   matches it and its arguments are checked as Postgres checks them
 *   (uuid syntax, enum values, integers).
 *
 *   node --experimental-strip-types scripts/gen-functions.ts [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Param = { name: string; type: string; default?: unknown; /** An enum parameter's values, from its schema-qualified type. */ enum?: string[] };
export type FunctionInfo = { roles: string[]; returns: string; params: Param[] };

const root = new URL('..', import.meta.url);

/** Splits a parameter list at its top-level commas (defaults can hold quoted commas). */
function splitParams(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    if (c === "'") quoted = !quoted;
    else if (!quoted && (c === '(' || c === '[')) depth += 1;
    else if (!quoted && (c === ')' || c === ']')) depth -= 1;
    if (c === ',' && !quoted && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    current += c;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** A Postgres array literal ('{a,b}') as a list. */
function arrayLiteral(text: string): string[] {
  const inner = text.replace(/^\{|\}$/g, '');
  return inner ? inner.split(',').map((item) => item.replace(/^"|"$/g, '')) : [];
}

export function parseDefault(expression: string, type: string): unknown {
  if (/^NULL(::.+)?$/.test(expression)) return null;
  if (expression === 'true' || expression === 'false') return expression === 'true';
  if (/^-?\d+(\.\d+)?$/.test(expression)) return Number(expression);
  if (/^ARRAY\[\]::/.test(expression)) return [];
  const literal = expression.match(/^'((?:[^']|'')*)'(?:::.+)?$/);
  if (literal) {
    const value = literal[1].replaceAll("''", "'");
    if (type.endsWith('[]')) return arrayLiteral(value);
    if (type === 'jsonb' || type === 'json') return JSON.parse(value);
    if (/^(integer|bigint|smallint)$/.test(type)) return Number(value);
    return value;
  }
  throw new Error(`Unparsed default ${expression} (${type})`);
}

export function functionInfo(dump: string): Record<string, FunctionInfo> {
  const out: Record<string, FunctionInfo> = {};
  const enums = new Map<string, string[]>();
  for (const match of dump.matchAll(/^create type ([a-z_]+\.[a-z_]+) as enum \((.*)\);$/gm)) {
    enums.set(match[1], [...match[2].matchAll(/'((?:[^']|'')*)'/g)].map((value) => value[1].replaceAll("''", "'")));
  }
  const roles: Record<string, Set<string>> = {};
  for (const match of dump.matchAll(/^grant execute on function ([a-z_]+)\.([a-z_0-9]+)\(.*\) to ([a-z_]+);$/gm)) {
    (roles[`${match[1]}.${match[2]}`] ??= new Set()).add(match[3]);
  }
  for (const statement of dump.split('\n--;;\n')) {
    const head = statement.match(/^CREATE OR REPLACE FUNCTION ([a-z_]+)\.([a-z_0-9]+)\((.*)\)\n RETURNS (.+)$/m);
    if (!head) continue;
    const [, schema, name, list, returns] = head;
    const key = `${schema}.${name}`;
    if (out[key]) throw new Error(`${key} is overloaded; the router matches by name`);
    const params = splitParams(list).map((part) => {
      const [, paramName, rest] = part.match(/^(?:IN |INOUT |VARIADIC )?([a-z_0-9]+) (.+)$/) ?? [];
      if (!paramName) throw new Error(`${key}: unparsed parameter ${part}`);
      const [type, defaultExpression] = rest.split(' DEFAULT ');
      const param: Param = { name: paramName, type: type.trim() };
      const values = enums.get(param.type.replace(/\[\]$/, ''));
      if (values) param.enum = values;
      if (defaultExpression !== undefined) param.default = parseDefault(defaultExpression.trim(), param.type);
      return param;
    });
    out[key] = { roles: [...(roles[key] ?? [])].sort(), returns: returns.trim(), params };
  }
  return Object.fromEntries(Object.keys(out).sort().map((key) => [key, out[key]]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = `${JSON.stringify(functionInfo(readFileSync(new URL('schema/pg-user-schema.sql', root), 'utf8')), null, 1)}\n`;
  const path = new URL('schema/functions.json', root);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== text) {
      console.error('schema/functions.json is out of date with schema/pg-user-schema.sql. Run npm run gen:functions.');
      process.exit(1);
    }
    console.log('Function signatures are up to date.');
  } else {
    writeFileSync(path, text);
    console.log(`${Object.keys(JSON.parse(text)).length} functions written to schema/functions.json.`);
  }
}
