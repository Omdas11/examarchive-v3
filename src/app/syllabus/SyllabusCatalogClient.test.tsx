import { render, screen, waitFor } from "@testing-library/react";
import SyllabusCatalogClient from "./SyllabusCatalogClient";

const tablePayload = {
  papers: [
    {
      paperCode: "PHY101",
      paperName: "Physics I",
      subjectCode: "PHY",
      units: 3,
      lectures: 12,
      course: "FYUG",
      stream: "Science",
      type: "DSC",
      university: "Test University",
    },
  ],
  subjects: [{ subjectCode: "PHY", papers: 1, units: 3 }],
};

describe("SyllabusCatalogClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it("renders papers from Syllabus_Table grouped by subject", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => tablePayload,
    }) as unknown as typeof fetch;

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => {
      expect(screen.getAllByText("PHY").length).toBeGreaterThan(0);
      expect(screen.getByText("Physics I")).toBeInTheDocument();
      expect(screen.getByText("PHY101")).toBeInTheDocument();
    });
  });

  it("shows an error state when syllabus table fetch fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    }) as unknown as typeof fetch;

    render(<SyllabusCatalogClient syllabi={[]} />);

    await waitFor(() => {
      expect(
        screen.getByText(/unable to load syllabus library/i),
      ).toBeInTheDocument();
    });
  });
});
