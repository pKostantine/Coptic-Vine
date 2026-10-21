/**
 * Saves the result of schema/pg-schema-dump.sql (the user schemas' DDL,
 * structure only) as schema/pg-user-schema.sql, the script the parity oracle
 * loads into PGlite (tests/lib/oracle.ts).
 *
 *   npm run save-schema-dump -- <saved execute_sql result or raw JSON>
 */
import { writeFileSync } from 'node:fs';
import { readSavedValue } from './lib/export.ts';

const from = process.argv[2];
if (!from) throw new Error('Pass the saved result of schema/pg-schema-dump.sql');
const ddl = readSavedValue<string>(from, 'ddl');
if (typeof ddl !== 'string' || !ddl.includes('create schema')) throw new Error(`${from} doesn't hold the dump's ddl`);
const header = `-- Generated from Supabase by schema/pg-schema-dump.sql (read-only, structure only) on ${new Date().toISOString().slice(0, 10)}.\n-- Loaded into PGlite as the parity oracle by tests/lib/oracle.ts. Do not edit by hand.\n`;
writeFileSync(new URL('../schema/pg-user-schema.sql', import.meta.url), `${header}${ddl}\n`);
console.log(`Saved ${ddl.split('\n').length} lines (${(ddl.length / 1024).toFixed(0)} KB).`);
