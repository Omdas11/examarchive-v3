// Confidence thresholds based on number of additional approved papers
// available for the same paper code.
const HIGH_CONFIDENCE_THRESHOLD = 2;
const MEDIUM_CONFIDENCE_THRESHOLD = 1;

export function calculateSourceConfidence(
  relatedPapersCount: number,
): "High" | "Medium" | "Baseline" {
  if (relatedPapersCount >= HIGH_CONFIDENCE_THRESHOLD) return "High";
  if (relatedPapersCount >= MEDIUM_CONFIDENCE_THRESHOLD) return "Medium";
  return "Baseline";
}
