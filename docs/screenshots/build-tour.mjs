// Stitch the 7 screenshots into a single animated WebP carousel.
// Each frame held for 2s, loops forever. Run with:
//   node docs/screenshots/build-tour.mjs
// Resolves sharp from sharp-cli's global install (npm i -g sharp-cli).
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sharp = (await import(
  pathToFileURL("/usr/lib/node_modules/sharp-cli/node_modules/sharp/lib/index.js").href
)).default;

const frames = readdirSync(here)
  .filter((n) => /^ttm-screenshot\d+\.png$/.test(n))
  .sort();

if (frames.length === 0) throw new Error("no ttm-screenshot*.png found");

const buffers = frames.map((n) => readFileSync(join(here, n)));

await sharp(buffers, { join: { animated: true } })
  .webp({
    quality: 78,
    effort: 6,
    loop: 0,
    delay: frames.map(() => 2000),
  })
  .toFile(join(here, "tour.webp"));

console.log(`tour.webp written — ${frames.length} frames, 2s each, infinite loop`);
