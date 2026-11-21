/**
 * Tests for the word matcher (md-verification-match). Page words are
 * synthetic OCR output: normalized boxes in reading order.
 */
import {
  distinctiveWords,
  findWordMatch,
  type PageWord,
} from "./md-verification-match";

function pageFromText(
  text: string,
  cols = 8,
): PageWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((text, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      text,
      x0: 0.05 + col * 0.11,
      y0: 0.05 + row * 0.08,
      x1: 0.05 + col * 0.11 + 0.09,
      y1: 0.05 + row * 0.08 + 0.05,
    };
  });
}

describe("distinctiveWords", () => {
  it("drops stopwords and short words, keeps order", () => {
    expect(
      distinctiveWords("Discuss the role of motivation and perception"),
    ).toEqual(["motivation", "perception"]);
  });

  it("returns [] for text with no usable words", () => {
    expect(distinctiveWords("What is value?")).toEqual(["value"]);
    expect(distinctiveWords("কি")).toEqual([]);
  });
});

describe("findWordMatch", () => {
  it("finds an exact line and boxes it", () => {
    const page = pageFromText(
      "Answer any two Discuss the role of motivation and perception in shaping consumer behaviour extra words here",
    );
    const match = findWordMatch(
      "Discuss the role of motivation and perception in shaping consumer behaviour.",
      page,
    );
    expect(match).not.toBeNull();
    expect(match!.matched).toBeGreaterThanOrEqual(3);
    expect(match!.box.x0).toBeLessThan(match!.box.x1);
    expect(match!.box.y0).toBeLessThan(match!.box.y1);
  });

  it("tolerates one OCR-misread word", () => {
    const page = pageFromText(
      "Discuss the role of motivation and perception in shaping consumer behavlour today",
    );
    const match = findWordMatch(
      "Discuss the role of motivation and perception in shaping consumer behaviour.",
      page,
    );
    expect(match).not.toBeNull();
    expect(match!.matched).toBeGreaterThanOrEqual(3);
  });

  it("returns null when the line is not on the page", () => {
    const page = pageFromText(
      "Financial management capital structure working capital dividend policy ratios",
    );
    expect(
      findWordMatch(
        "Analyze the relevance of Howard and Sheth Model in modern marketing.",
        page,
      ),
    ).toBeNull();
  });

  it("returns null for a question with too few distinctive words", () => {
    const page = pageFromText("What is value in economics today");
    expect(findWordMatch("What is value?", page)).toBeNull();
  });
});
