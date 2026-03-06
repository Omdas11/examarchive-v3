/**
 * Shared utility functions for ExamArchive v3.
 */

/**
 * Convert an integer to a Roman numeral string.
 * Supports 1–10 (semester numbers).
 */
export function toRoman(num: number): string {
  const map: [string, number][] = [
    ["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1],
  ];
  let result = "";
  let n = num;
  for (const [k, v] of map) {
    while (n >= v) {
      result += k;
      n -= v;
    }
  }
  return result;
}
