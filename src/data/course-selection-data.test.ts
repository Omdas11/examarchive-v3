import {
  matchesCoursePreferenceSelection,
  type CoursePreferences,
} from "./course-selection-data";

describe("matchesCoursePreferenceSelection", () => {
  const prefs: CoursePreferences = {
    dsc: "Computer Science",
    dsm1: "Economics",
    dsm2: "History",
    sec: "Computer Science",
    idc: "Geography",
    aec: "English",
    vac: "Yoga",
    savedAt: new Date().toISOString(),
  };

  it("matches whole-word subjects with normalized whitespace and punctuation", () => {
    expect(
      matchesCoursePreferenceSelection({
        prefs,
        category: "DSC",
        subjectFields: ["  Computer   Science  "],
      }),
    ).toBe(true);

    expect(
      matchesCoursePreferenceSelection({
        prefs,
        category: "DSC",
        subjectFields: ["Computer Sciences"],
      }),
    ).toBe(false);
  });
});
