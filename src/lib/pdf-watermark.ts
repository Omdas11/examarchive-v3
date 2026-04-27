import { PDFDocument, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

/**
 * Load Inter Bold WOFF bytes from the @fontsource/inter package bundled with
 * the application.  Falls back gracefully if the file is absent.
 */
function loadInterFont(): Buffer | null {
  try {
    const fontPath = path.join(
      process.cwd(),
      "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff",
    );
    return fs.readFileSync(fontPath);
  } catch {
    return null;
  }
}

const WATERMARK_TEXT = "EXAMARCHIVE";
const FONT_SIZE = 18;
/** Horizontal distance between tile origins. */
const TILE_X = 160;
/** Vertical distance between tile origins. */
const TILE_Y = 100;
/** Offset applied to every other row for a staggered mosaic effect. */
const STAGGER = TILE_X / 2;
const ROTATION = degrees(45);
const COLOUR = rgb(0.6, 0.6, 0.6);
const OPACITY = 0.15;

/**
 * Applies a mosaic-tiled "EXAMARCHIVE" watermark (Inter Bold, 45°) to every
 * page of a PDF.  Only applied on downloads; inline previews are unaffected.
 *
 * @param pdfBytes  Raw PDF bytes (ArrayBuffer, Uint8Array, or Buffer).
 * @returns         Plain ArrayBuffer of the watermarked PDF.
 */
export async function applyDownloadWatermark(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer,
): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Register fontkit so we can embed a custom (Inter) font.
  pdfDoc.registerFontkit(fontkit);

  // Try to load Inter Bold; fall back to Helvetica if it is unavailable.
  const interBytes = loadInterFont();
  const font = interBytes
    ? await pdfDoc.embedFont(interBytes)
    : await pdfDoc.embedFont("Helvetica-Bold" as Parameters<typeof pdfDoc.embedFont>[0]);

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();

    // Tile across an area larger than the page so rotated tiles near the edges
    // are still visible after the 45° transform.
    const margin = Math.max(width, height);
    let row = 0;
    for (let y = -margin; y < height + margin; y += TILE_Y, row++) {
      const offset = row % 2 === 0 ? 0 : STAGGER;
      for (let x = -margin + offset; x < width + margin; x += TILE_X) {
        page.drawText(WATERMARK_TEXT, {
          x,
          y,
          size: FONT_SIZE,
          font,
          color: COLOUR,
          opacity: OPACITY,
          rotate: ROTATION,
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  // Copy into a clean ArrayBuffer to avoid SharedArrayBuffer ambiguity (TS 5.9+).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}
