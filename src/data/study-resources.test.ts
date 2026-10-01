import {
  STUDY_RESOURCES,
  STUDY_RESOURCE_CATEGORIES,
} from "./study-resources";

describe("study-resources", () => {
  it("only uses https URLs", () => {
    for (const r of STUDY_RESOURCES) {
      expect(r.url.startsWith("https://")).toBe(true);
    }
  });

  it("has no duplicate entries", () => {
    const keys = STUDY_RESOURCES.map((r) => `${r.title}|${r.url}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses only known categories", () => {
    for (const r of STUDY_RESOURCES) {
      expect(STUDY_RESOURCE_CATEGORIES).toContain(r.category);
    }
  });

  it("covers the key official links for HGC FYUGP students", () => {
    const urls = STUDY_RESOURCES.map((r) => r.url);
    expect(urls).toContain("https://haflonggovtcollege.ac.in");
    expect(urls).toContain("https://aus.ac.in");
    expect(urls).toContain("https://epathshala.nic.in");
    expect(urls).toContain("https://nptel.ac.in");
    expect(urls).toContain("https://swayam.gov.in");
    expect(urls).toContain("https://epgp.inflibnet.ac.in");
  });
});
