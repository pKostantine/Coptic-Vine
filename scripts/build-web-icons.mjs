/**
 * Rebuilds public/icons/, the icons the website's web app manifest names:
 * what a phone or desktop shows once Coptic Vine is added to the home screen
 * or installed from the browser.
 *
 * Run it after the app icon changes:  node scripts/build-web-icons.mjs
 *
 *  - coptic-vine-192.png / coptic-vine-512.png: the app icon as it is, for
 *    launchers that show it whole ("any").
 *  - coptic-vine-maskable-512.png: for launchers that crop to a circle or a
 *    squircle ("maskable"). The gold vine is lifted off the icon and set,
 *    a little smaller, on a full-bleed fall of the icon's own green, so it
 *    sits inside the safe zone (the inner 80% circle) and no crop cuts into
 *    it. Lifted rather than drawn from a separate asset because the Android
 *    adaptive icon's foreground file is empty.
 */
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ICON = new URL('../assets/images/coptic-vine-icon.png', import.meta.url);
const OUT = new URL('../public/icons/', import.meta.url);
const SIZE = 512;
/** The vine's size inside the maskable icon: it already fits the safe circle at full size, so this is margin. */
const VINE_SCALE = 0.9;
const GOLD = [0xe3, 0xb5, 0x3b];

await mkdir(OUT, { recursive: true });
const icon = await readFile(ICON);

for (const size of [192, 512]) {
  const png = await sharp(icon).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(new URL(`coptic-vine-${size}.png`, OUT), png);
  console.log(`Wrote public/icons/coptic-vine-${size}.png — ${(png.length / 1024).toFixed(0)}KB`);
}

/**
 * The vine alone, gold on transparent. Each row's background is read from
 * its leftmost pixel (the vine never reaches the edge), and a pixel's
 * distance from it, against the distance of pure gold, is its coverage —
 * which keeps the anti-aliased edges soft instead of keyed to a hard cut.
 */
async function liftVine(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    const background = [data[row], data[row + 1], data[row + 2]];
    const full = distance(GOLD, background);
    for (let x = 0; x < width; x += 1) {
      const i = row + x * 4;
      const coverage = Math.min(1, distance([data[i], data[i + 1], data[i + 2]], background) / full);
      out[i] = GOLD[0];
      out[i + 1] = GOLD[1];
      out[i + 2] = GOLD[2];
      out[i + 3] = Math.round(coverage * 255);
    }
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// The same fall of green the icon has, drawn full-bleed so a crop at any
// edge still lands on it.
const background = Buffer.from(`<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1D4424"/>
      <stop offset="100%" stop-color="#14301B"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#fall)"/>
</svg>`);
const vineSize = Math.round(SIZE * VINE_SCALE);
const vine = await sharp(await liftVine(icon)).resize(vineSize, vineSize).toBuffer();
const maskable = await sharp(background)
  .composite([{ input: vine, top: Math.round((SIZE - vineSize) / 2), left: Math.round((SIZE - vineSize) / 2) }])
  .flatten({ background: '#14301B' })
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(new URL('coptic-vine-maskable-512.png', OUT), maskable);
console.log(`Wrote public/icons/coptic-vine-maskable-512.png — ${(maskable.length / 1024).toFixed(0)}KB`);
