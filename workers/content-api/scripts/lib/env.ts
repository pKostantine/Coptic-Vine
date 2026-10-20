import { readFileSync } from 'node:fs';

/** The repository's .env (the app's public Supabase URL and anon key), with real environment variables taking precedence. */
export function loadEnv(): (name: string) => string {
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(new URL('../../../../.env', import.meta.url), 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* no .env: environment only */ }
  return (name) => process.env[name] || values[name] || '';
}
