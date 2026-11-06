import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { afterEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';

const workerSource = await readFile(new URL('../workers/web-app/src/index.js', import.meta.url), 'utf8');
const workerModule = await import(
  'data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64')
);
const worker = workerModule.default;

const RELEASE_ID = 'bab96e57-727c-43a9-af88-36a7e6535b4a';
const PLAYLIST_ID = 'a2c69b08-2d9c-4f40-a13c-940f5031b7de';
const ASSET_ID = 'c439ccf6-1662-4bcd-909a-0d24433c6282';
const ASSET_PATH = 'processed/release/version/cover.jpg';
const PREVIEW = {
  title: 'Liturgy with Cantor Ibrahim Ayad',
  description: 'Cantor Ibrahim Ayad',
  imageAsset: {
    id: ASSET_ID,
    provider: 'cloudflare_r2',
    bucket: 'chc-images',
    path: ASSET_PATH,
    mimeType: 'image/jpeg',
  },
};
const APP_SHELL = `<!doctype html>
<html><head>
<title>Coptic Vine</title>
<!-- COPTIC_VINE_SHARE_META_START -->
<meta property="og:title" content="Coptic Vine" />
<meta property="og:image" content="https://copticvine.ca/apple-touch-icon.png" />
<!-- COPTIC_VINE_SHARE_META_END -->
</head><body><div id="root"></div></body></html>`;

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
});

function makeEnv(assetResponse = new Response(APP_SHELL, {
  headers: { 'Content-Type': 'text/html; charset=UTF-8' },
})) {
  const requests = [];
  return {
    requests,
    env: {
      ASSETS: {
        async fetch(request) {
          requests.push(request);
          return assetResponse.clone();
        },
      },
    },
  };
}

function mockPreview(preview = PREVIEW, expectedPath = `/music/release/${RELEASE_ID}`) {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://api.copticvine.ca/rest/v1/rpc/get_share_preview');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('accept-profile'), 'public');
    assert.equal(new Headers(init?.headers).get('content-profile'), 'public');
    assert.deepEqual(JSON.parse(init?.body), {
      p_path: expectedPath,
      p_locale: 'en',
    });
    return new Response(JSON.stringify(preview), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

test('dedicated share route returns crawler-ready entity metadata without touching static assets', async () => {
  mockPreview();
  const { env, requests } = makeEnv();
  const request = new Request(
    `https://copticvine.ca/share/music/release/${RELEASE_ID}?v=${ASSET_ID}`,
  );

  const response = await worker.fetch(request, env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-coptic-vine-share-preview'), 'dedicated');
  assert.equal(requests.length, 0);
  assert.match(html, /<meta property="og:type" content="music\.album" \/>/);
  assert.match(html, /<meta property="og:title" content="Liturgy with Cantor Ibrahim Ayad — Coptic Vine" \/>/);
  assert.match(
    html,
    new RegExp('<meta property="og:image" content="https://copticvine\\.ca/__share-image\\?bucket=chc-images&amp;path='),
  );
  assert.doesNotMatch(html, /<meta property="og:image" content="[^"]*apple-touch-icon\.png"/);
  assert.match(html, new RegExp(`window\\.location\\.replace\\("https://copticvine\\.ca/music/release/${RELEASE_ID}"\\)`));
});

test('artist and track share routes select their entity-specific Open Graph types and images', async () => {
  const cases = [
    {
      path: '/music/artist/17fb29e5-bb89-4dc3-88c9-139db65371c3',
      title: 'Cantor Tharwat Nady',
      type: 'profile',
    },
    {
      path: '/music/track/41b174ac-e066-4736-92a7-268d581700b6',
      title: 'Taishouri and Hiten',
      type: 'music.song',
    },
  ];

  for (const item of cases) {
    mockPreview({ ...PREVIEW, title: item.title }, item.path);
    const { env, requests } = makeEnv();

    const response = await worker.fetch(
      new Request('https://copticvine.ca/share' + item.path + '?v=' + ASSET_ID),
      env,
    );
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(requests.length, 0);
    assert.match(html, new RegExp(`<meta property="og:type" content="${item.type.replace('.', '\\.')}" \\/>`));
    assert.match(html, new RegExp(`<meta property="og:title" content="${item.title} — Coptic Vine" \\/>`));
    assert.match(html, /<meta property="og:image" content="https:\/\/copticvine\.ca\/__share-image\?/);
  }
});

test('public playlist share routes use the visibility-safe playlist preview RPC', async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://api.copticvine.ca/rest/v1/rpc/get_music_playlist_share_preview');
    assert.deepEqual(JSON.parse(init?.body), { p_playlist_id: PLAYLIST_ID });
    return new Response(JSON.stringify({ ...PREVIEW, title: 'Sunday Liturgy' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const { env, requests } = makeEnv();

  const response = await worker.fetch(
    new Request(`https://copticvine.ca/share/music/playlist/${PLAYLIST_ID}`),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(requests.length, 0);
  assert.match(html, /<meta property="og:type" content="music\.playlist" \/>/);
  assert.match(html, /<meta property="og:title" content="Sunday Liturgy — Coptic Vine" \/>/);
  assert.match(html, new RegExp(`window\\.location\\.replace\\("https://copticvine\\.ca/music/playlist/${PLAYLIST_ID}"\\)`));
});

test('direct entity route replaces the generic SPA Open Graph block', async () => {
  mockPreview();
  const { env, requests } = makeEnv();
  const request = new Request(`https://copticvine.ca/music/release/${RELEASE_ID}`);

  const response = await worker.fetch(request, env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-coptic-vine-share-preview'), 'entity');
  assert.equal(requests.length, 1);
  assert.match(html, /<title>Liturgy with Cantor Ibrahim Ayad — Coptic Vine<\/title>/);
  assert.match(html, /<meta property="og:type" content="music\.album" \/>/);
  assert.doesNotMatch(html, /<meta property="og:title" content="Coptic Vine" \/>/);
  assert.doesNotMatch(html, /<meta property="og:image" content="https:\/\/copticvine\.ca\/apple-touch-icon\.png" \/>/);
});

test('share image route proxies the published entity artwork as an inline image', async () => {
  const expectedBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      'https://cv-media-resolver.hrmpdd8d6c.workers.dev/images/processed/release/version/cover.jpg',
    );
    assert.equal(init?.method, 'GET');
    return new Response(expectedBytes, {
      headers: {
        'Content-Length': String(expectedBytes.byteLength),
        'Content-Type': 'image/jpeg',
        ETag: '"art-v1"',
      },
    });
  };
  const { env, requests } = makeEnv();
  const url = new URL('https://copticvine.ca/__share-image');
  url.searchParams.set('bucket', 'chc-images');
  url.searchParams.set('path', ASSET_PATH);
  url.searchParams.set('v', ASSET_ID);

  const response = await worker.fetch(new Request(url), env);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('content-disposition'), 'inline');
  assert.equal(response.headers.get('x-coptic-vine-share-image'), 'proxied');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expectedBytes);
  assert.equal(requests.length, 0);
});

test('dedicated share route returns a non-cacheable error instead of poisoning previews with the app logo', async () => {
  console.error = () => {};
  globalThis.fetch = async () => new Response('upstream unavailable', { status: 503 });
  const { env, requests } = makeEnv();

  const response = await worker.fetch(
    new Request(`https://copticvine.ca/share/music/release/${RELEASE_ID}`),
    env,
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-coptic-vine-share-preview'), 'error');
  assert.equal(requests.length, 0);
  assert.doesNotMatch(await response.text(), /apple-touch-icon/);
});

test('unrelated routes remain ordinary static asset requests', async () => {
  globalThis.fetch = async () => {
    throw new Error('The metadata API should not run for a static route.');
  };
  const staticResponse = new Response('static asset', { status: 200 });
  const { env, requests } = makeEnv(staticResponse);

  const response = await worker.fetch(new Request('https://copticvine.ca/bible'), env);

  assert.equal(await response.text(), 'static asset');
  assert.equal(requests.length, 1);
});

test('previews come from cv-api with no key, or from where DATA_API_URL says', async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://api.copticvine.ca/rest/v1/rpc/get_share_preview');
    assert.equal(new Headers(init?.headers).get('apikey'), null);
    return new Response(JSON.stringify(PREVIEW), { headers: { 'Content-Type': 'application/json' } });
  };
  const defaults = await worker.fetch(new Request(`https://copticvine.ca/share/music/release/${RELEASE_ID}`, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } }), makeEnv().env);
  assert.equal(defaults.status, 200);
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'http://localhost:8790/rest/v1/rpc/get_share_preview');
    return new Response(JSON.stringify(PREVIEW), { headers: { 'Content-Type': 'application/json' } });
  };
  const { env } = makeEnv();
  env.DATA_API_URL = 'http://localhost:8790/';
  const response = await worker.fetch(new Request(`https://copticvine.ca/share/music/release/${RELEASE_ID}`, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } }), env);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Liturgy with Cantor Ibrahim Ayad/);
});

// ─── An invite to be someone's support person (workers/api/src/rpc/canonSupport.ts) ─

const CANON_INVITE_ID = 'Qm9vdGhIb2xkc1RoZUNhbm9u';
const CANON_INVITE = {
  id: CANON_INVITE_ID,
  sharerName: 'Mina',
  message: 'Will you keep me in prayer and help me <keep> my canon?',
  withInstructions: true,
  createdAt: '2026-11-06T18:00:00.000Z',
  own: false,
  supporting: null,
};

function mockCanonInvite(invite = CANON_INVITE, status = 200) {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(init?.body) });
    assert.equal(new Headers(init?.headers).get('content-profile'), 'public');
    return status === 200
      ? new Response(JSON.stringify(invite), { headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ code: 'P0002', message: 'This invite link was turned off' }), { status });
  };
  return calls;
}

test('a canon invite’s link previews as their invitation to be a support person, not as the app', async () => {
  const calls = mockCanonInvite();
  const { env, requests } = makeEnv();

  const response = await worker.fetch(new Request(`https://copticvine.ca/canon/invite/${CANON_INVITE_ID}`), env);
  const html = await response.text();

  assert.deepEqual(calls, [{ url: 'https://api.copticvine.ca/rest/v1/rpc/get_canon_support_invite', body: { p_id: CANON_INVITE_ID } }]);
  assert.equal(response.status, 200);
  assert.equal(requests.length, 1, 'the app itself still opens at the link');
  assert.equal(response.headers.get('x-coptic-vine-share-preview'), 'canon-invite');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
  assert.match(html, /<title>Mina invites you to be their support person — Coptic Vine<\/title>/);
  assert.match(html, /<meta property="og:title" content="Mina invites you to be their support person — Coptic Vine" \/>/);
  assert.match(html, /<meta property="og:description" content="“Will you keep me in prayer and help me &lt;keep&gt; my canon\?” · See their spiritual canon and how they keep it, to keep them in prayer\." \/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/copticvine\.ca\/coptic-vine-canon-invite\.png" \/>/);
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  assert.doesNotMatch(html, /<meta property="og:title" content="Coptic Vine" \/>/);
});

test('a canon invite’s preview speaks the sender’s language, and stands without a name or a word', async () => {
  mockCanonInvite({ ...CANON_INVITE, sharerName: null, message: null });
  const french = await (await worker.fetch(new Request(`https://copticvine.ca/canon/invite/${CANON_INVITE_ID}?lang=fr`), makeEnv().env)).text();
  assert.match(french, /<meta property="og:title" content="Une invitation à être une personne de soutien — Coptic Vine" \/>/);
  assert.match(french, /<meta property="og:description" content="Voyez son canon spirituel et comment il le garde, pour prier pour lui\." \/>/);
  assert.match(french, /<meta property="og:locale" content="fr_FR" \/>/);

  mockCanonInvite();
  const arabic = await (await worker.fetch(new Request(`https://copticvine.ca/canon/invite/${CANON_INVITE_ID}?lang=ar`), makeEnv().env)).text();
  assert.match(arabic, /<meta property="og:title" content="يدعوك Mina لتكون الشخص الداعم له — Coptic Vine" \/>/);
});

test('an invite link turned off previews as the app, with nothing of who sent it', async () => {
  mockCanonInvite(null, 400);
  const { env, requests } = makeEnv();
  const response = await worker.fetch(new Request(`https://copticvine.ca/canon/invite/${CANON_INVITE_ID}`), env);
  assert.equal(requests.length, 1);
  assert.equal(await response.text(), APP_SHELL);

  globalThis.fetch = async () => {
    throw new Error('No preview is looked up for what isn’t an invite link.');
  };
  const odd = makeEnv();
  await worker.fetch(new Request('https://copticvine.ca/canon/invite/short'), odd.env);
  await worker.fetch(new Request(`https://copticvine.ca/canon/invite/${CANON_INVITE_ID}`, { method: 'POST' }), odd.env);
  await worker.fetch(new Request(`https://copticvine.ca/canon/shared/${CANON_INVITE_ID}`), odd.env);
  assert.equal(odd.requests.length, 3);
});
