import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SyllabusCatalogClient from "./SyllabusCatalogClient";
import type { Syllabus } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFetch(payload: unknown, ok = true) {
  return jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => payload,
  }) as unknown as typeof fetch;
}

function makeSyllabus(overrides: Partial<Syllabus> = {}): Syllabus {
  return {
    id: "s1",
    university: "Test Uni",
    subject: "Mathematics",
    department: "Science",
    semester: "",
    programme: "FYUG",
    year: 2024,
    uploader_id: "u1",
    approval_status: "approved",
    file_url: "https://example.com/math.pdf",
    created_at: "2024-01-15T10:00:00Z",
    course_code: "MATH101",
    course_name: "Math Course",
    ...overrides,
  };
}

const tablePayload = {
  papers: [
    {
      paperCode: "PHY101",
      paperName: "Physics I",
      subject: "",
      subjectCode: "PHY",
      credits: 4,
      units: 3,
      lectures: 12,
      questionPapers: [{ paperId: "paper-1", year: 2023 }],
      course: "FYUG",
      stream: "Science",
      type: "DSC",
      university: "Test University",
    },
  ],
  subjects: [{ subjectCode: "PHY", subjectName: "PHY", papers: 1, units: 3 }],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SyllabusCatalogClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  // ── Catalog tab (default) ──────────────────────────────────────────────────

  it("renders papers from Syllabus_Table grouped by subject", async () => {
    global.fetch = makeFetch(tablePayload);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => {
      expect(screen.getAllByText("PHY").length).toBeGreaterThan(0);
      expect(screen.getByText("Physics I")).toBeInTheDocument();
      expect(screen.getByText("PHY101")).toBeInTheDocument();
    });
  });

  it("shows an error state when syllabus table fetch fails", async () => {
    global.fetch = makeFetch({}, false);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => {
      expect(
        screen.getByText(/unable to load syllabus library/i),
      ).toBeInTheDocument();
    });
  });

  it("shows loading spinner while fetch is in progress", () => {
    // Never resolves
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;

    render(<SyllabusCatalogClient syllabi={[]} />);

    expect(screen.getByText(/loading syllabus library/i)).toBeInTheDocument();
  });

  it("shows paper count stat badge after papers load", async () => {
    global.fetch = makeFetch(tablePayload);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => {
      expect(screen.getByText(/1 paper in catalog/i)).toBeInTheDocument();
    });
  });

  it("shows PDF count stat in hero regardless of load state", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus()];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    expect(screen.getByText(/1 PDF uploaded/i)).toBeInTheDocument();
  });

  it("shows empty state when no papers match search", async () => {
    global.fetch = makeFetch(tablePayload);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => screen.getByText("Physics I"));

    const searchInput = screen.getByPlaceholderText(/search by code, name/i);
    fireEvent.change(searchInput, { target: { value: "ZZZNOTFOUND" } });

    expect(screen.getByText(/no papers match/i)).toBeInTheDocument();
  });

  it("filters papers by search query (paper code)", async () => {
    const multiPayload = {
      papers: [
        { ...tablePayload.papers[0] },
        {
          paperCode: "CHEM201",
          paperName: "Chemistry II",
          subject: "Chemistry",
          subjectCode: "CHEM",
          credits: 3,
          units: 2,
          lectures: 10,
          questionPapers: [],
          course: "FYUG",
          stream: "Science",
          type: "DSC",
          university: "Test University",
        },
      ],
      subjects: [],
    };
    global.fetch = makeFetch(multiPayload);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => screen.getByText("Chemistry II"));

    const searchInput = screen.getByPlaceholderText(/search by code, name/i);
    fireEvent.change(searchInput, { target: { value: "PHY" } });

    expect(screen.getByText("Physics I")).toBeInTheDocument();
    expect(screen.queryByText("Chemistry II")).not.toBeInTheDocument();
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("filters papers by subject chip", async () => {
    const multiPayload = {
      papers: [
        { ...tablePayload.papers[0] },
        {
          paperCode: "CHEM201",
          paperName: "Chemistry II",
          subject: "Chemistry",
          subjectCode: "CHEM",
          credits: 3,
          units: 2,
          lectures: 10,
          questionPapers: [],
          course: "FYUG",
          stream: "Science",
          type: "DSC",
          university: "Test University",
        },
      ],
      subjects: [],
    };
    global.fetch = makeFetch(multiPayload);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => screen.getByText("Chemistry II"));

    // Click the "Chemistry" subject chip
    fireEvent.click(screen.getByRole("button", { name: "Chemistry" }));

    expect(screen.queryByText("Physics I")).not.toBeInTheDocument();
    expect(screen.getByText("Chemistry II")).toBeInTheDocument();
  });

  it("shows credits and lectures badges in PaperCard", async () => {
    global.fetch = makeFetch(tablePayload);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => {
      expect(screen.getByText("4 cr")).toBeInTheDocument();
      expect(screen.getByText("12 lec")).toBeInTheDocument();
    });
  });

  it("shows year link with examType in PaperCard", async () => {
    const payload = {
      papers: [
        {
          ...tablePayload.papers[0],
          questionPapers: [{ paperId: "p1", year: 2022, examType: "Annual" }],
        },
      ],
      subjects: [],
    };
    global.fetch = makeFetch(payload);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => {
      expect(screen.getByText("2022")).toBeInTheDocument();
      // examType slice(0,3) = "Ann"
      expect(screen.getByText("Ann")).toBeInTheDocument();
    });
  });

  it("shows expand/collapse button when paper has more than 4 question-paper years", async () => {
    const manyQps = Array.from({ length: 6 }, (_, i) => ({
      paperId: `p${i}`,
      year: 2020 + i,
    }));
    const payload = {
      papers: [{ ...tablePayload.papers[0], questionPapers: manyQps }],
      subjects: [],
    };
    global.fetch = makeFetch(payload);

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => screen.getByText(/\+2 more/i));

    // Initially shows "+2 more" button; click to expand
    fireEvent.click(screen.getByText(/\+2 more/i));

    expect(screen.getByText("Less ▲")).toBeInTheDocument();

    // Collapse again
    fireEvent.click(screen.getByText("Less ▲"));

    expect(screen.getByText(/\+2 more/i)).toBeInTheDocument();
  });

  it("shows linked syllabus PDF badge on PaperCard when code matches", async () => {
    global.fetch = makeFetch(tablePayload);

    // Syllabus whose course_code matches the paper code "PHY101"
    const syllabus = makeSyllabus({ course_code: "PHY101", year: 2024 });

    render(<SyllabusCatalogClient syllabi={[syllabus]} />);

    await waitFor(() => {
      expect(screen.getByText("PDF (2024)")).toBeInTheDocument();
    });
  });

  it("shows PDF badge without year when year is null", async () => {
    global.fetch = makeFetch(tablePayload);

    const syllabus = makeSyllabus({ course_code: "PHY101", year: null });

    render(<SyllabusCatalogClient syllabi={[syllabus]} />);

    await waitFor(() => {
      // Should render "PDF" without a parenthesised year
      const pdfLinks = screen.getAllByText("PDF");
      expect(pdfLinks.length).toBeGreaterThan(0);
    });
  });

  it("shows no papers message when fetch returns empty list", async () => {
    global.fetch = makeFetch({ papers: [], subjects: [] });

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => {
      expect(screen.getByText(/no syllabus entries found/i)).toBeInTheDocument();
    });
  });

  // ── PDF Library tab ────────────────────────────────────────────────────────

  it("switches to PDF Library tab when clicked", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus()];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByText(/departmental syllabi/i)).toBeInTheDocument();
  });

  it("PDF Library shows empty state when syllabi list is empty", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;

    render(<SyllabusCatalogClient syllabi={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByText(/no approved syllabus pdfs yet/i)).toBeInTheDocument();
  });

  it("PDF Library shows DEPT card for syllabus with no semester", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ semester: "" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    // Both section header and card show "DEPT"
    expect(screen.getAllByText("DEPT").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /open pdf for mathematics/i })).toBeInTheDocument();
  });

  it("PDF Library shows SEM card for syllabus with a semester", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ semester: "3" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    // Both section header and card show "SEM"
    expect(screen.getAllByText("SEM").length).toBeGreaterThan(0);
    expect(screen.getByText(/semester 3/i)).toBeInTheDocument();
  });

  it("PDF Library shows programme badge for FYUG syllabus", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ programme: "FYUG" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByText("FYUG")).toBeInTheDocument();
  });

  it("PDF Library shows programme badge for NEP syllabus", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ programme: "NEP 2020" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByText("NEP 2020")).toBeInTheDocument();
  });

  it("PDF Library shows programme badge for unknown programme", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ programme: "CBCS" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByText("CBCS")).toBeInTheDocument();
  });

  it("PDF Library does not show programme badge when programme is empty", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ programme: "" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    // No programme badge rendered
    expect(screen.queryByText(/FYUG|NEP|CBCS/)).not.toBeInTheDocument();
  });

  it("PDF Library shows year on card", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ year: 2023 })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByText("2023")).toBeInTheDocument();
  });

  it("PDF Library shows em-dash when year is null", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ year: null })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("PDF Library shows date string when created_at is set", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    // Jan 15, 2024
    const syllabi = [makeSyllabus({ created_at: "2024-01-15T10:00:00Z" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    // Date formatted as "Jan 15, 2024"
    expect(screen.getByText(/jan 15, 2024/i)).toBeInTheDocument();
  });

  it("PDF Library uses course_name as title fallback when subject is empty", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ subject: "", course_name: "Advanced Math" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByRole("link", { name: /open pdf for advanced math/i })).toBeInTheDocument();
  });

  it("PDF Library uses course_code as title fallback when subject and course_name are empty", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ subject: "", course_name: "", course_code: "MATH999" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByRole("link", { name: /open pdf for math999/i })).toBeInTheDocument();
  });

  it("PDF Library uses 'Syllabus' as final title fallback", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [makeSyllabus({ subject: "", course_name: "", course_code: "" })];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    expect(screen.getByRole("link", { name: /open pdf for syllabus/i })).toBeInTheDocument();
  });

  it("PDF Library filter pills narrow to Departmental-only", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [
      makeSyllabus({ id: "d1", semester: "", subject: "Dept Paper" }),
      makeSyllabus({ id: "s1", semester: "2", subject: "Sem Paper" }),
    ];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    // Click "Departmental" filter pill
    fireEvent.click(screen.getByRole("button", { name: /departmental/i }));

    expect(screen.getByText("Dept Paper")).toBeInTheDocument();
    expect(screen.queryByText("Sem Paper")).not.toBeInTheDocument();
  });

  it("PDF Library filter pills narrow to Semester-wise only", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [
      makeSyllabus({ id: "d1", semester: "", subject: "Dept Paper" }),
      makeSyllabus({ id: "s1", semester: "2", subject: "Sem Paper" }),
    ];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    fireEvent.click(screen.getByRole("button", { name: /semester-wise/i }));

    expect(screen.queryByText("Dept Paper")).not.toBeInTheDocument();
    expect(screen.getByText("Sem Paper")).toBeInTheDocument();
  });

  it("PDF Library 'All' filter shows both sections", () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    const syllabi = [
      makeSyllabus({ id: "d1", semester: "", subject: "Dept Paper" }),
      makeSyllabus({ id: "s1", semester: "2", subject: "Sem Paper" }),
    ];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));

    // Both sections should be visible under "All" (default)
    expect(screen.getByText("Dept Paper")).toBeInTheDocument();
    expect(screen.getByText("Sem Paper")).toBeInTheDocument();
  });

  it("tab toggle switches back to catalog from PDF Library", async () => {
    global.fetch = makeFetch(tablePayload);
    const syllabi = [makeSyllabus()];

    render(<SyllabusCatalogClient syllabi={syllabi} />);

    // Switch to PDF tab
    fireEvent.click(screen.getByRole("button", { name: /pdf library/i }));
    expect(screen.getByText(/departmental syllabi/i)).toBeInTheDocument();

    // Switch back to catalog
    fireEvent.click(screen.getByRole("button", { name: /syllabus catalog/i }));

    await waitFor(() => {
      expect(screen.getByText("Physics I")).toBeInTheDocument();
    });
  });
});
