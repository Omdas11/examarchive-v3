import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

/**
 * Applies a diagonal, semi-transparent watermark to every page of a PDF.
 *
 * @param pdfBytes  Raw PDF buffer (ArrayBuffer, Uint8Array, or Buffer).
 * @returns         Plain ArrayBuffer of the watermarked PDF.
 */
export async function applyDownloadWatermark(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer,
): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const watermarkText = "examarchive.dev";
  const fontSize = 42;
  // Semi-transparent grey so the watermark is visible but not obtrusive.
  const colour = rgb(0.6, 0.6, 0.6);
  const opacity = 0.18;
  const rotationAngle = degrees(45);

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // Centre the watermark on the page.
    const x = (width - textWidth) / 2;
    const y = (height - textHeight) / 2;

    page.drawText(watermarkText, {
      x,
      y,
      size: fontSize,
      font,
      color: colour,
      opacity,
      rotate: rotationAngle,
    });
  }

  const bytes = await pdfDoc.save();
  // Create a clean ArrayBuffer from the typed array bytes (TS 5.9+ strict typing).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}
