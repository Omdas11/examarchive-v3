/**
 * Minimal types for tesseract.js v7, which ships no TypeScript
 * declarations. Only the surface this app uses is declared here.
 */
declare module "tesseract.js" {
  export interface TesseractWord {
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }
  export interface TesseractWorker {
    recognize(
      image: HTMLCanvasElement | string,
    ): Promise<{ data: { words: TesseractWord[] } }>;
    terminate(): Promise<void>;
  }
  export function createWorker(
    langs?: string,
    oem?: number,
    options?: Record<string, unknown>,
  ): Promise<TesseractWorker>;
}
