import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("renders registry entries from backend in the library tab", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => tablePayload,
    }) as unknown as typeof fetch;

    render(<SyllabusCatalogClient syllabi={[]} />);

    fireEvent.click(screen.getByText("Syllabus from Syllabus_Table"));

    await waitFor(() => {
      expect(screen.getByText("Physics I")).toBeInTheDocument();
      expect(screen.getByText("PHY101")).toBeInTheDocument();
    });
  });

  it("shows an error state when registry fetch fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    render(<SyllabusCatalogClient syllabi={[]} />);

    fireEvent.click(screen.getByText("Syllabus from Syllabus_Table"));

    await waitFor(() => {
      expect(
        screen.getByText(/unable to load syllabus library/i),
      ).toBeInTheDocument();
    });
  });
});
