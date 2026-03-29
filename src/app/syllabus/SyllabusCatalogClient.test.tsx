import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SyllabusCatalogClient from "./SyllabusCatalogClient";

const registryPayload = {
  entries: [
    {
      paper_code: "PHY101",
      paper_name: "Physics I",
      semester: 1,
      subject: "Physics",
      credits: 3,
      programme: "FYUGP",
      university: "Test University",
      category: "DSC",
    },
  ],
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
      json: async () => registryPayload,
    }) as unknown as typeof fetch;

    render(<SyllabusCatalogClient syllabi={[]} />);

    fireEvent.click(screen.getByText("Paper Syllabus Library"));

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

    fireEvent.click(screen.getByText("Paper Syllabus Library"));

    await waitFor(() => {
      expect(
        screen.getByText(/unable to load the syllabus registry/i),
      ).toBeInTheDocument();
    });
  });
});
