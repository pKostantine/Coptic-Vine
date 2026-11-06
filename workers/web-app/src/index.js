const DATA_API_URL = 'https://api.copticvine.ca';

// Where the previews' data comes from: cv-api, unless DATA_API_URL (wrangler.jsonc) says another address.
function dataApi(env) {
  return { url: env && typeof env.DATA_API_URL === 'string' && env.DATA_API_URL ? env.DATA_API_URL.replace(/\/+$/, '') : DATA_API_URL };
}
const MEDIA_BASE_URL = 'https://cv-media-resolver.hrmpdd8d6c.workers.dev';
const APP_NAME = 'Coptic Vine';
const DEFAULT_DESCRIPTION = 'Cross-platform Coptic Orthodox worship app for multilingual liturgical books, Scripture, and hymns.';

const PUBLIC_BUCKET_ROUTES = {
  'chc-music': 'music',
  'chc-learning': 'learning',
  'chc-images': 'images',
};

const ENTITY_KINDS = {
  music: {
    artist: 'profile',
    playlist: 'music.playlist',
    release: 'music.album',
    track: 'music.song',
  },
  learn: {
    cantor: 'profile',
    album: 'website',
    lesson: 'website',
  },
};

const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';
const ENTITY_PATH_PATTERN = new RegExp(
  '^/(share/)?(music|learn)/([^/]+)/(' + UUID_PATTERN + ')/?$',
);

// A shared spiritual canon (src/app/canon/shared/[id].tsx): its id is cv-api's
// 24-character random link id (workers/api/src/rpc/canonShares.ts).
const CANON_SHARE_PATH_PATTERN = /^\/canon\/shared\/([A-Za-z0-9_-]{16,64})\/?$/;
const CANON_SHARE_IMAGE = '/coptic-vine-canon-share.png';
/** How many of a shared canon's items its preview names before "and 3 more". */
const CANON_PREVIEW_ITEMS = 6;
const CANON_PREVIEW_MESSAGE = 160;

/**
 * A shared canon's preview in the language of the one who shared it (the
 * link's ?lang=, as the app writes it): whose canon it is and what it holds,
 * so it reads as their canon and not as the app.
 */
const CANON_WORDS = {
  en: {
    titleOf: (name) => name + '’s Spiritual Canon',
    title: 'A Shared Spiritual Canon',
    sharedWithYou: 'Shared with you',
    more: (count) => 'and ' + count + ' more',
    quote: (text) => '“' + text + '”',
    separator: ', ',
    kinds: { agpeya: 'Agpeya', bible: 'Bible reading', metania: 'Metanias', abstinence: 'Abstinence' },
  },
  fr: {
    titleOf: (name) => 'Le canon spirituel de ' + name,
    title: 'Un canon spirituel partagé',
    sharedWithYou: 'Partagé avec vous',
    more: (count) => 'et ' + count + ' de plus',
    quote: (text) => '« ' + text + ' »',
    separator: ', ',
    kinds: { agpeya: 'Agpia', bible: 'Lecture de la Bible', metania: 'Métanies', abstinence: 'Abstinence' },
  },
  ar: {
    titleOf: (name) => 'قانون ' + name + ' الروحي',
    title: 'قانون روحي مُشارَك',
    sharedWithYou: 'مُشارَك معك',
    more: (count) => 'و' + count + ' غيرها',
    quote: (text) => '«' + text + '»',
    separator: '، ',
    kinds: { agpeya: 'الأجبية', bible: 'قراءة الكتاب المقدس', metania: 'المطانيات', abstinence: 'الانقطاع' },
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseEntityPath(pathname) {
  const match = ENTITY_PATH_PATTERN.exec(pathname);
  if (!match) return null;

  const [, sharePrefix, section, kind, id] = match;
  const ogType = ENTITY_KINDS[section]?.[kind];
  if (!ogType) return null;

  return {
    dedicated: Boolean(sharePrefix),
    id,
    kind,
    ogType,
    path: '/' + section + '/' + kind + '/' + id,
    section,
  };
}

function encodeObjectPath(path) {
  const segments = String(path || '').split('/').filter(Boolean);
  if (
    segments.length === 0
    || segments.some((segment) => segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\0'))
  ) {
    return null;
  }

  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

function previewLocale(url) {
  return url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';
}

async function loadPreview(target, locale, env) {
  const playlist = target.section === 'music' && target.kind === 'playlist';
  const rpc = playlist ? 'get_music_playlist_share_preview' : 'get_share_preview';
  const body = playlist
    ? { p_playlist_id: target.id }
    : { p_path: target.path, p_locale: locale };
  const api = dataApi(env);
  const response = await fetch(api.url + '/rest/v1/rpc/' + rpc, {
    method: 'POST',
    headers: {
      'Accept-Profile': 'public',
      'Content-Type': 'application/json',
      'Content-Profile': 'public',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('preview_rpc_' + response.status);
  }

  const preview = await response.json();
  if (!preview || typeof preview !== 'object') {
    throw new Error('preview_rpc_invalid_payload');
  }

  return preview;
}

function parseCanonSharePath(pathname) {
  const match = CANON_SHARE_PATH_PATTERN.exec(pathname);
  return match ? { id: match[1], path: '/canon/shared/' + match[1] } : null;
}

function canonLocale(url) {
  const lang = url.searchParams.get('lang');
  return lang === 'fr' || lang === 'ar' ? lang : 'en';
}

/** What a canon link holds, or null when it was stopped or never was (or cv-api can't say). */
async function loadCanonShare(id, env) {
  try {
    const response = await fetch(dataApi(env).url + '/rest/v1/rpc/get_canon_share', {
      method: 'POST',
      headers: {
        'Accept-Profile': 'public',
        'Content-Type': 'application/json',
        'Content-Profile': 'public',
      },
      body: JSON.stringify({ p_id: id }),
    });
    if (!response.ok) return null;
    const share = await response.json();
    return share && typeof share === 'object' && Array.isArray(share.items) ? share : null;
  } catch (error) {
    console.error('Unable to load canon share preview', error);
    return null;
  }
}

function oneLine(value, limit) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text) return '';
  return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
}

/** "Mina’s Spiritual Canon" over "“For our Friday group” · Agpeya, Bible reading, Metanias". */
function canonPreview(share, locale) {
  const words = CANON_WORDS[locale];
  const name = oneLine(share.sharerName, 80);
  const names = share.items
    .map((item) => (item && item.kind === 'custom' ? oneLine(item.title, 60) : words.kinds[item?.kind]))
    .filter(Boolean)
    .filter((title, index, all) => all.indexOf(title) === index);
  const shown = names.slice(0, CANON_PREVIEW_ITEMS);
  const rest = names.length - shown.length;
  const items = shown.join(words.separator) + (rest > 0 ? words.separator + words.more(rest) : '');
  const message = oneLine(share.message, CANON_PREVIEW_MESSAGE);
  return {
    title: name ? words.titleOf(name) : words.title,
    description: [message ? words.quote(message) : words.sharedWithYou, items].filter(Boolean).join(' · '),
  };
}

function canonShareMetadata(url, target, share) {
  const locale = canonLocale(url);
  const preview = canonPreview(share, locale);
  const canonicalUrl = url.origin + target.path;
  const imageUrl = url.origin + CANON_SHARE_IMAGE;
  const metadata = buildMetadata({
    canonicalUrl,
    description: preview.description,
    imageUrl,
    mimeType: 'image/png',
    ogType: 'website',
    previewUrl: url.origin + url.pathname + url.search,
    title: preview.title,
  });
  // A link handed to friends, never one for search engines.
  metadata.tags = '<meta name="robots" content="noindex" />\n'
    + (locale === 'en' ? '' : '<meta property="og:locale" content="' + (locale === 'fr' ? 'fr_FR' : 'ar_AR') + '" />\n')
    + metadata.tags;
  return { metadata };
}

function resolveDirectImage(asset) {
  if (!asset || typeof asset !== 'object') return null;

  if (asset.provider === 'external' && typeof asset.path === 'string') {
    try {
      const externalUrl = new URL(asset.path);
      return externalUrl.protocol === 'https:' ? externalUrl.toString() : null;
    } catch {
      return null;
    }
  }

  const route = PUBLIC_BUCKET_ROUTES[asset.bucket];
  const encodedPath = encodeObjectPath(asset.path);
  if (asset.provider !== 'cloudflare_r2' || !route || !encodedPath) return null;

  return MEDIA_BASE_URL + '/' + route + '/' + encodedPath;
}

function sameOriginImage(origin, asset) {
  if (!asset || typeof asset !== 'object') return null;
  if (
    asset.provider !== 'cloudflare_r2'
    || !PUBLIC_BUCKET_ROUTES[asset.bucket]
    || !encodeObjectPath(asset.path)
  ) {
    return null;
  }

  const params = new URLSearchParams({
    bucket: asset.bucket,
    path: asset.path,
    v: String(asset.id || asset.version || '1'),
  });

  return origin + '/__share-image?' + params.toString();
}

function buildMetadata({ canonicalUrl, description, directImage, imageUrl, mimeType, ogType, previewUrl, title }) {
  const pageTitle = title || APP_NAME;
  const fullTitle = pageTitle.includes(APP_NAME) ? pageTitle : pageTitle + ' — ' + APP_NAME;
  const summary = description?.trim() || DEFAULT_DESCRIPTION;
  const safeTitle = escapeHtml(fullTitle);
  const safeSummary = escapeHtml(summary);
  const safeCanonical = escapeHtml(canonicalUrl);
  const safePreview = escapeHtml(previewUrl);
  const safeImage = escapeHtml(imageUrl);
  const safeDirectImage = directImage && directImage !== imageUrl ? escapeHtml(directImage) : null;
  const safeMime = mimeType ? escapeHtml(mimeType) : null;

  const tags = [
    '<meta name="description" content="' + safeSummary + '" />',
    '<link rel="canonical" href="' + safeCanonical + '" />',
    '<link rel="image_src" href="' + safeImage + '" />',
    '<meta property="og:site_name" content="' + APP_NAME + '" />',
    '<meta property="og:type" content="' + escapeHtml(ogType || 'website') + '" />',
    '<meta property="og:title" content="' + safeTitle + '" />',
    '<meta property="og:description" content="' + safeSummary + '" />',
    '<meta property="og:url" content="' + safePreview + '" />',
    '<meta property="og:image" content="' + safeImage + '" />',
    '<meta property="og:image:url" content="' + safeImage + '" />',
    '<meta property="og:image:secure_url" content="' + safeImage + '" />',
    safeMime ? '<meta property="og:image:type" content="' + safeMime + '" />' : '',
    '<meta property="og:image:alt" content="' + escapeHtml(pageTitle) + '" />',
    safeDirectImage ? '<meta property="og:image" content="' + safeDirectImage + '" />' : '',
    safeDirectImage ? '<meta property="og:image:secure_url" content="' + safeDirectImage + '" />' : '',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' + safeTitle + '" />',
    '<meta name="twitter:description" content="' + safeSummary + '" />',
    '<meta name="twitter:image" content="' + safeImage + '" />',
    '<meta name="twitter:image:alt" content="' + escapeHtml(pageTitle) + '" />',
    '<meta itemprop="image" content="' + safeImage + '" />',
  ].filter(Boolean).join('\n');

  return { fullTitle, pageTitle, safeSummary, tags };
}

function entityMetadata(url, target, preview) {
  const canonicalUrl = url.origin + target.path;
  const previewUrl = target.dedicated
    ? url.origin + url.pathname + url.search
    : canonicalUrl;
  const directImage = resolveDirectImage(preview.imageAsset);
  const proxiedImage = sameOriginImage(url.origin, preview.imageAsset);
  const imageUrl = proxiedImage || directImage || url.origin + '/coptic-vine-share.png';

  return {
    canonicalUrl,
    directImage,
    imageUrl,
    metadata: buildMetadata({
      canonicalUrl,
      description: preview.description,
      directImage,
      imageUrl,
      mimeType: preview.imageAsset?.mimeType || null,
      ogType: target.ogType,
      previewUrl,
      title: preview.title,
    }),
    previewUrl,
    targetUrl: canonicalUrl,
  };
}

function dedicatedShareResponse(request, entity) {
  const { metadata, imageUrl, targetUrl } = entity;
  const safeTarget = escapeHtml(targetUrl);
  const safeImage = escapeHtml(imageUrl);
  const html = '<!doctype html>\n'
    + '<html lang="en">\n<head>\n'
    + '<meta charset="utf-8" />\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1" />\n'
    + '<title>' + escapeHtml(metadata.fullTitle) + '</title>\n'
    + '<meta name="robots" content="noindex,follow" />\n'
    + '<link rel="icon" href="' + safeImage + '" />\n'
    + '<link rel="apple-touch-icon" href="' + safeImage + '" />\n'
    + '<!-- COPTIC_VINE_SHARE_META_START -->\n' + metadata.tags + '\n<!-- COPTIC_VINE_SHARE_META_END -->\n'
    + '</head>\n<body style="margin:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif">\n'
    + '<main style="max-width:680px;margin:64px auto;padding:24px;text-align:center">\n'
    + '<img src="' + safeImage + '" alt="" style="width:min(78vw,420px);aspect-ratio:1;object-fit:cover;border-radius:20px" />\n'
    + '<h1 style="font-size:26px;margin:24px 0 8px">' + escapeHtml(metadata.pageTitle) + '</h1>\n'
    + '<p style="color:#cdd8cb">' + metadata.safeSummary + '</p>\n'
    + '<p><a href="' + safeTarget + '" style="color:#e3b53b">Open in ' + APP_NAME + '</a></p>\n'
    + '</main>\n'
    + '<script>window.location.replace(' + JSON.stringify(targetUrl) + ');</script>\n'
    + '<noscript><meta http-equiv="refresh" content="0;url=' + safeTarget + '" /></noscript>\n'
    + '</body>\n</html>';

  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60',
      'Content-Type': 'text/html; charset=UTF-8',
      'X-Coptic-Vine-Share-Preview': 'dedicated',
      'X-Robots-Tag': 'noindex',
    },
  });
}

async function getAppShell(request, env) {
  let response = await env.ASSETS.fetch(request);
  const contentType = response.headers.get('content-type') || '';
  if (response.ok && contentType.includes('text/html')) return response;

  const indexUrl = new URL('/index.html', request.url);
  response = await env.ASSETS.fetch(new Request(indexUrl, request));
  return response;
}

async function entityAppResponse(request, env, entity, {
  cacheControl = 'public, max-age=0, s-maxage=300, stale-while-revalidate=60',
  kind = 'entity',
  noindex = false,
} = {}) {
  const response = await getAppShell(request, env);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('text/html')) return response;

  const html = await response.text();
  const shareBlock = /<!-- COPTIC_VINE_SHARE_META_START -->[\s\S]*?<!-- COPTIC_VINE_SHARE_META_END -->/i;
  const markedTags = '<!-- COPTIC_VINE_SHARE_META_START -->\n'
    + entity.metadata.tags
    + '\n<!-- COPTIC_VINE_SHARE_META_END -->';
  let transformed = html.replace(
    /<title>[^<]*<\/title>/i,
    '<title>' + escapeHtml(entity.metadata.fullTitle) + '</title>',
  );
  transformed = shareBlock.test(transformed)
    ? transformed.replace(shareBlock, markedTags)
    : transformed.replace('</head>', markedTags + '\n</head>');

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('Cache-Control', cacheControl);
  headers.set('X-Coptic-Vine-Share-Preview', kind);
  if (noindex) headers.set('X-Robots-Tag', 'noindex');

  return new Response(request.method === 'HEAD' ? null : transformed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function shareImageResponse(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const bucket = url.searchParams.get('bucket');
  const route = PUBLIC_BUCKET_ROUTES[bucket];
  const objectPath = encodeObjectPath(url.searchParams.get('path'));
  if (!route || !objectPath) return new Response('Not found', { status: 404 });

  const upstream = await fetch(MEDIA_BASE_URL + '/' + route + '/' + objectPath, {
    method: request.method,
    headers: {
      Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8,*/*;q=0.5',
      'User-Agent': 'Coptic-Vine-Link-Preview/3.0',
    },
  });

  if (!upstream.ok) {
    return new Response('Image unavailable', {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    return new Response('Invalid image response', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
  headers.set('Content-Disposition', 'inline');
  headers.set('Content-Type', contentType);
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('X-Coptic-Vine-Share-Image', 'proxied');
  headers.set('X-Content-Type-Options', 'nosniff');
  for (const header of ['content-length', 'etag', 'last-modified']) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: 200,
    headers,
  });
}

function previewFailureResponse(error) {
  console.error('Unable to load entity share preview', error);
  return new Response('Unable to load share preview', {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=UTF-8',
      'Retry-After': '30',
      'X-Coptic-Vine-Share-Preview': 'error',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/__share-image') {
      return shareImageResponse(request, url);
    }

    const canonShare = parseCanonSharePath(url.pathname);
    if (canonShare && (request.method === 'GET' || request.method === 'HEAD')) {
      const share = await loadCanonShare(canonShare.id, env);
      // A stopped link previews as the app itself: nothing of what it held.
      if (!share) return env.ASSETS.fetch(request);
      // Not kept anywhere, so a link stopped is a preview gone.
      return entityAppResponse(request, env, canonShareMetadata(url, canonShare, share), {
        cacheControl: 'private, no-store',
        kind: 'canon-share',
        noindex: true,
      });
    }

    const target = parseEntityPath(url.pathname);
    if (!target || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return env.ASSETS.fetch(request);
    }

    let preview;
    try {
      preview = await loadPreview(target, previewLocale(url), env);
    } catch (error) {
      if (target.dedicated) return previewFailureResponse(error);
      return env.ASSETS.fetch(request);
    }

    const entity = entityMetadata(url, target, preview);
    return target.dedicated
      ? dedicatedShareResponse(request, entity)
      : entityAppResponse(request, env, entity);
  },
};
