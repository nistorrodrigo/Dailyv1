/**
 * One-shot converter: Latin Securities Adobe Illustrator brand assets
 * (PDF-wrapped .ai files) → high-resolution transparent PNGs ready to
 * ship as `public/logo-white.png` and `public/logo.png`.
 *
 * Why a custom pipeline rather than a one-liner npm package?
 *   1. The "negativo" .ai (white logo for dark backgrounds) has no
 *      canvas background. Naive rasterizers paint a white default
 *      under the logo and the white-on-white blends to invisible.
 *      We pass `background: 'rgba(0,0,0,0)'` to PDF.js to suppress
 *      that default fill, getting genuine RGBA output.
 *   2. The .ai canvas is much larger than the artwork bounding box,
 *      so we trim the resulting PNG to the visible content with
 *      sharp's `trim()` (uses the corner pixel as the threshold,
 *      transparent here, so it crops to the glyph).
 *   3. Final size is capped — the raw ~8000px raster is overkill.
 *      We resize to a target width that's enough for 3× DPR rendering
 *      at the largest size we ever show the logo (~180px CSS in the
 *      LoginGate splash → 540 device px → we ship 1600 to keep slack).
 *
 * Run:
 *
 *   # Install temp deps (kept out of package.json so the runtime
 *   # bundle stays small — these are only needed for this offline
 *   # one-off conversion).
 *   npm install --no-save sharp pdfjs-dist@4 @napi-rs/canvas
 *
 *   node tools/convert-logos.mjs
 *
 *   # Then commit the new public/logo*.png and push.
 *
 * Re-run only when the brand team ships an updated artwork; the
 * output PNGs are committed and consumed both by the React app
 * (Header, LoginGate) and the email HTML generator (which fetches
 * them at runtime and base64-encodes for inline embedding).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
// Use the legacy build of pdfjs-dist — it ships as CommonJS-friendly
// ESM that runs cleanly under Node without the worker plumbing the
// browser build assumes.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const DOWNLOADS = "C:/Users/rnistor/Downloads";
const TARGETS = [
  {
    src: path.join(DOWNLOADS, "Logo latin securities_negativo_RGB_junio 2022.ai"),
    dest: path.join(repoRoot, "public", "logo-white.png"),
    label: "negativo (white-on-transparent, used in Header / LoginGate / email header)",
  },
  {
    src: path.join(DOWNLOADS, "Logo latin securities RGB_junio 2022.ai"),
    dest: path.join(repoRoot, "public", "logo.png"),
    label: "positivo (dark-on-transparent, used in email footer)",
  },
];

// PDF.js renders at this ratio of the page's natural viewport. 6 keeps
// rasters comfortably above 3000px wide on these assets — plenty of
// detail before downstream sharp.resize compresses to the target width.
const PDF_RENDER_SCALE = 6;
// Target width after trim+resize. 1600 px is enough for 3× DPR at the
// LoginGate splash (~180 CSS px → 540 device px). Header use only
// needs ~408 device px so this is a generous ceiling.
const TARGET_WIDTH = 1600;

async function rasterizePdfPageRGBA(pdfPath) {
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, disableFontFace: true, useSystemFonts: false }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");

  // pdfjs-dist node bindings expect a `canvasContext` shape close to
  // the browser's. The `background: "rgba(0,0,0,0)"` option tells
  // PDF.js to skip its default white fill, preserving the canvas's
  // initial transparent pixels for areas the artwork doesn't cover.
  await page.render({
    canvasContext: ctx,
    viewport,
    background: "rgba(0,0,0,0)",
  }).promise;

  await doc.cleanup();
  await doc.destroy();

  // @napi-rs/canvas returns PNG (with alpha) directly; sharp will
  // happily ingest the buffer for downstream trim+resize.
  return canvas.encode("png");
}

async function convertOne({ src, dest, label }) {
  console.log(`→ ${label}`);
  console.log(`  ${path.basename(src)}`);

  const rawPng = await rasterizePdfPageRGBA(src);

  // sharp.trim() crops away pixels matching the corner colour within
  // a tolerance. For our transparent rasters this strips the empty
  // canvas around the artwork, leaving a tight bounding box.
  // Then resize to the agreed cap, preserving aspect.
  const processed = await sharp(rawPng)
    .trim({ threshold: 1 })
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, processed.data);

  console.log(
    `  ✓ ${path.relative(repoRoot, dest)} — ${processed.info.width}×${processed.info.height} ` +
    `(${processed.info.channels}ch, ${(processed.data.length / 1024).toFixed(1)} KB)\n`,
  );
}

(async () => {
  for (const t of TARGETS) {
    try {
      await convertOne(t);
    } catch (err) {
      console.error(`  ✗ failed: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    }
  }
  console.log("Done. Commit public/logo-white.png and public/logo.png.");
})();
