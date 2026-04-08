import {
  AVAILABLE_SUBJECTS,
  matchesCoursePreferenceSelection,
  type CoursePreferences,
} from "./course-selection-data";
import { getAllSubjects } from "./syllabus-registry";

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

describe("AVAILABLE_SUBJECTS", () => {
  it("only includes subjects that exist in syllabus registry", () => {
    const registrySubjects = new Set(getAllSubjects());
    for (const subject of AVAILABLE_SUBJECTS) {
      expect(registrySubjects.has(subject)).toBe(true);
    }
  });
});
