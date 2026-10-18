/**
 * Rebuilds assets/images/coptic-vine-seal-screen.png, the seal as the app
 * draws it on screen: Home's hero, the sidebar, the loading and notice pages.
 *
 * Run it after the seal changes:  node scripts/build-screen-seal.mjs
 *
 * The full seal (coptic-vine-seal.png, 1024px, ~800KB) stays the source for
 * the splash screen and the share card, where its size is wanted. On screen
 * it is drawn at most 184 points on a phone and 230 on the desktop's Home,
 * so 600px covers a 3x phone and a 2x desktop,
 * and a palette PNG brings it to a tenth of the download — which, on the
 * website, was the single largest file on the first load.
 */
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE = new URL('../assets/images/coptic-vine-seal.png', import.meta.url);
const OUTPUT = new URL('../assets/images/coptic-vine-seal-screen.png', import.meta.url);
const SIZE = 600;

const png = await sharp(await readFile(SOURCE))
  .resize(SIZE, SIZE)
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toBuffer();

const sizeKb = png.length / 1024;
if (sizeKb > 160) {
  throw new Error(`Screen seal is ${sizeKb.toFixed(0)}KB; it is meant to be a fraction of the full seal. Lower the palette quality.`);
}

await writeFile(OUTPUT, png);
console.log(`Wrote assets/images/coptic-vine-seal-screen.png — ${SIZE}x${SIZE}, ${sizeKb.toFixed(0)}KB`);
