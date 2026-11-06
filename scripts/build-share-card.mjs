/**
 * Rebuilds public/coptic-vine-share.png, the image WhatsApp, iMessage and the
 * rest show when a Coptic Vine link is pasted into a chat, and
 * public/coptic-vine-canon-invite.png, the one an invite to be someone's
 * support person for their spiritual canon shows instead (workers/web-app),
 * so it reads as an invitation and not as the app.
 *
 * Run it after the seal or the vine divider changes:  node scripts/build-share-card.mjs
 *
 * The constraints the card is built to, which are why it is not simply the
 * seal file served directly:
 *  - 1200x630 is the Open Graph size both WhatsApp and Apple render as a wide
 *    banner. A square image gets a small thumbnail tile in WhatsApp instead.
 *  - No alpha. The seal's corners are transparent, and clients disagree about
 *    what to put behind them — some black, some white.
 *  - Small. WhatsApp gives up on images past a few hundred KB, and the seal on
 *    its own is ~790KB.
 */
import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
/** Leaves a margin top and bottom while keeping the seal the whole subject. */
const SEAL = 520;
const SOURCE = new URL('../assets/images/coptic-vine-seal.png', import.meta.url);
const OUTPUT = new URL('../public/coptic-vine-share.png', import.meta.url);

const background = Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="46%" r="62%">
      <stop offset="0%" stop-color="#1D4424"/>
      <stop offset="55%" stop-color="#14301B"/>
      <stop offset="100%" stop-color="#0A1A0F"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
</svg>`);

const seal = await sharp(await readFile(SOURCE))
  .resize(SEAL, SEAL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

const card = await sharp(background)
  .composite([{ input: seal, top: Math.round((HEIGHT - SEAL) / 2), left: Math.round((WIDTH - SEAL) / 2) }])
  .flatten({ background: '#14301B' })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toBuffer();

function checkSize(buffer, name) {
  const sizeKb = buffer.length / 1024;
  if (sizeKb > 300) {
    throw new Error(`${name} is ${sizeKb.toFixed(0)}KB; WhatsApp may skip it. Lower the palette quality.`);
  }
  return sizeKb;
}

const sizeKb = checkSize(card, 'Share card');
await writeFile(OUTPUT, card);
console.log(`Wrote public/coptic-vine-share.png — ${WIDTH}x${HEIGHT}, ${sizeKb.toFixed(0)}KB`);

// ─── A canon invite's card ──────────────────────────────────────────────────
// The seal to the left; to its right the design system's gold eyebrow, the
// title in Georgia bold, and the vine divider the app draws under its heroes
// (src/components/vine/ui/Ornaments.tsx, read from there so the two agree).
const CANON_OUTPUT = new URL('../public/coptic-vine-canon-invite.png', import.meta.url);
const CANON_SEAL = 380;
const SEAL_LEFT = 92;
const TEXT_LEFT = 540;

const ornaments = await readFile(new URL('../src/components/vine/ui/Ornaments.tsx', import.meta.url), 'utf8');
const divider = /const VINE_DIVIDER = `(<svg[^`]+<\/svg>)`/.exec(ornaments)?.[1];
if (!divider) throw new Error('VINE_DIVIDER not found in src/components/vine/ui/Ornaments.tsx');
const DIVIDER_WIDTH = 300;
const DIVIDER_HEIGHT = Math.round((DIVIDER_WIDTH * 36) / 200);
const placedDivider = divider.replace(
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
  `<svg x="${TEXT_LEFT - 18}" y="356" width="${DIVIDER_WIDTH}" height="${DIVIDER_HEIGHT}"`,
);

const canonText = Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <text x="${TEXT_LEFT}" y="250" fill="#E3B53B" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="4">AN INVITATION</text>
  <text x="${TEXT_LEFT - 3}" y="330" fill="#FFFFFF" font-family="Georgia, Cormorant Garamond, serif" font-size="68" font-weight="700">Support Person</text>
  ${placedDivider}
</svg>`);

const canonSeal = await sharp(await readFile(SOURCE))
  .resize(CANON_SEAL, CANON_SEAL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

const canonCard = await sharp(background)
  .composite([
    { input: canonSeal, top: Math.round((HEIGHT - CANON_SEAL) / 2), left: SEAL_LEFT },
    { input: canonText, top: 0, left: 0 },
  ])
  .flatten({ background: '#14301B' })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toBuffer();

const canonKb = checkSize(canonCard, 'Canon invite card');
await writeFile(CANON_OUTPUT, canonCard);
console.log(`Wrote public/coptic-vine-canon-invite.png — ${WIDTH}x${HEIGHT}, ${canonKb.toFixed(0)}KB`);
