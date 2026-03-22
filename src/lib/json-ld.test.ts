import { buildPaperJsonLd, serializeJsonLd } from "./json-ld";

describe("json-ld helpers", () => {
  it("buildPaperJsonLd creates paper schema with canonical paper URL", () => {
    const jsonLd = buildPaperJsonLd({
      id: "paper-1",
      title: "Data Structures",
      course_code: "CSC-201",
      course_name: "Computer Science",
    } as never);

    expect(jsonLd["@type"]).toBe("ScholarlyArticle");
    expect(jsonLd.url).toBe("https://www.examarchive.dev/paper/paper-1");
  });

  it("serializeJsonLd escapes script-breaking sequences", () => {
    const serialized = serializeJsonLd({
      title: "XSS </script><script>alert(1)</script>",
    });

    expect(serialized).toContain("\\u003c/script>");
    expect(serialized).not.toContain("</script>");
  });
});
