import {
  AVAILABLE_SUBJECTS,
  matchesCoursePreferenceSelection,
  semesterLabel,
  semesterShort,
  type CoursePreferences,
} from "./course-selection-data";
import { getAllSubjects } from "./syllabus-registry";

describe("matchesCoursePreferenceSelection", () => {
  const prefs: CoursePreferences = {
    semester: "3",
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

describe("semesterLabel / semesterShort", () => {
  it("ordinals 1-8", () => {
    expect(semesterLabel("1")).toBe("1st Semester");
    expect(semesterLabel("2")).toBe("2nd Semester");
    expect(semesterLabel("3")).toBe("3rd Semester");
    expect(semesterLabel("4")).toBe("4th Semester");
    expect(semesterLabel(7)).toBe("7th Semester");
    expect(semesterShort("5")).toBe("5th Sem");
  });

  it("blank or out-of-range input stays blank", () => {
    expect(semesterLabel("")).toBe("");
    expect(semesterLabel(null)).toBe("");
    expect(semesterLabel("9")).toBe("");
    expect(semesterLabel("abc")).toBe("");
    expect(semesterShort(undefined)).toBe("");
  });
});
