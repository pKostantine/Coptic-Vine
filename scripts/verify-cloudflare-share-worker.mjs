import { access, readFile } from 'node:fs/promises';

const requiredRoutes = [
  '/share/*',
  '/__share-image',
  '/music/artist/*',
  '/music/playlist/*',
  '/music/release/*',
  '/music/track/*',
  '/learn/cantor/*',
  '/learn/album/*',
  '/learn/lesson/*',
];

const [worker, configSource, appShell] = await Promise.all([
  readFile(new URL('../workers/web-app/src/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
  readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
]);
const config = JSON.parse(configSource);

if (!appShell.includes('COPTIC_VINE_SHARE_META_START')) {
  throw new Error('Expo app shell is missing the replaceable share metadata block.');
}

for (const marker of ['X-Coptic-Vine-Share-Preview', '/__share-image', 'get_share_preview', 'Content-Profile']) {
  if (!worker.includes(marker)) {
    throw new Error(`Cloudflare share worker is missing required marker: ${marker}`);
  }
}

for (const route of requiredRoutes) {
  if (!config.assets?.run_worker_first?.includes(route)) {
    throw new Error(`Cloudflare Worker-first routes are missing: ${route}`);
  }
}

if (config.main !== './workers/web-app/src/index.js') {
  throw new Error('Wrangler main must point to the web app Worker entry point.');
}

// Worker Previews (what Workers Builds deploys for every branch that is not
// master) read their settings from this block and refuse to run without it.
// The Worker has no bindings or variables of its own, so it stays empty.
if (!config.previews || typeof config.previews !== 'object' || Array.isArray(config.previews)) {
  throw new Error('Wrangler config must carry a `previews` block, or branch previews cannot be deployed.');
}

if (
  config.assets?.directory !== './dist'
  || config.assets?.binding !== 'ASSETS'
  || config.assets?.not_found_handling !== 'single-page-application'
) {
  throw new Error('Wrangler static asset configuration is incomplete.');
}

// public/_headers hardens every static asset response (nosniff, a referrer
// policy, no camera/microphone/geolocation); the export must carry it.
const headersFile = await readFile(new URL('../dist/_headers', import.meta.url), 'utf8').catch(() => '');
if (!/^\/\*\s*\n(?:\s+[\w-]+: .+\n?)+/m.test(headersFile) || !headersFile.includes('X-Content-Type-Options: nosniff')) {
  throw new Error('dist/_headers is missing or does not harden every asset response (see public/_headers).');
}

for (const pagesArtifact of ['../dist/_worker.js', '../dist/_routes.json']) {
  try {
    await access(new URL(pagesArtifact, import.meta.url));
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  throw new Error(`Pages-only artifact must not be uploaded by Workers: ${pagesArtifact}`);
}

console.log('Verified Workers Static Assets and dynamic entity share routes.');
