import { render, screen } from "@testing-library/react";
import PaperCard from "./PaperCard";
import type { Paper } from "@/types";

describe("PaperCard", () => {
  const basePaper: Paper = {
    $id: "paper_123",
    id: "paper_123",
    title: "Test Paper",
    course_code: "CS101",
    department: "Computer Science",
    year: 2024,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("renders basic paper information", () => {
    render(<PaperCard paper={basePaper} />);
    expect(screen.getByText("Test Paper")).toBeInTheDocument();
    expect(screen.getByText("CS101")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  describe("resolveDownloadUrl logic", () => {
    it("uses file_id over file_url if present", () => {
      render(<PaperCard paper={{ ...basePaper, file_id: "file_456", file_url: "https://example.com/test.pdf" }} />);
      const downloadLink = screen.getByTitle("Download PDF");
      expect(downloadLink).toHaveAttribute("href", "/api/files/papers/file_456?download=1");
    });

    it("uses absolute file_url and appends download parameter", () => {
      render(<PaperCard paper={{ ...basePaper, file_url: "https://example.com/test.pdf" }} />);
      const downloadLink = screen.getByTitle("Download PDF");
      expect(downloadLink).toHaveAttribute("href", "https://example.com/test.pdf?download=1");
    });

    it("uses http absolute file_url and appends download parameter", () => {
      render(<PaperCard paper={{ ...basePaper, file_url: "http://example.com/test.pdf" }} />);
      const downloadLink = screen.getByTitle("Download PDF");
      expect(downloadLink).toHaveAttribute("href", "http://example.com/test.pdf?download=1");
    });

    it("handles relative file_url and appends download parameter", () => {
      render(<PaperCard paper={{ ...basePaper, file_url: "/local/path.pdf" }} />);
      const downloadLink = screen.getByTitle("Download PDF");
      expect(downloadLink).toHaveAttribute("href", "/local/path.pdf?download=1");
    });

    it("handles missing url gracefully", () => {
      render(<PaperCard paper={basePaper} />);
      const downloadLink = screen.getByTitle("Download PDF");
      expect(downloadLink).toHaveAttribute("href", "#");
    });

    it("does not incorrectly process relative URLs that start with http string without protocol", () => {
      render(<PaperCard paper={{ ...basePaper, file_url: "http-course-notes.pdf" }} />);
      const downloadLink = screen.getByTitle("Download PDF");
      expect(downloadLink).toHaveAttribute("href", "/http-course-notes.pdf?download=1");
    });
  });

  describe("category and semester rendering", () => {
    it("renders paper_type, exam_type, and programme badges", () => {
      render(
        <PaperCard
          paper={{
            ...basePaper,
            paper_type: "DSC",
            exam_type: "EndSem",
            programme: "B.Tech",
          }}
        />
      );
      expect(screen.getByText("DSC")).toBeInTheDocument();
      expect(screen.getByText("EndSem")).toBeInTheDocument();
      expect(screen.getByText("B.Tech")).toBeInTheDocument();
    });

    it("renders roman numeral for semester correctly", () => {
      render(<PaperCard paper={{ ...basePaper, semester: "4" }} />);
      expect(screen.getByText("Sem IV")).toBeInTheDocument();
    });

    it("renders fallback text for non-integer semesters", () => {
      render(<PaperCard paper={{ ...basePaper, semester: "Elective" }} />);
      expect(screen.getByText("Sem Elective")).toBeInTheDocument();
    });
  });

  describe("stats and metadata", () => {
    it("renders uploader, view count, and download count if present", () => {
      render(
        <PaperCard
          paper={{
            ...basePaper,
            uploaded_by_username: "john_doe",
            view_count: 150,
            download_count: 42,
            marks: 100,
            duration: 180,
            institute: "Test Institute",
          }}
        />
      );
      expect(screen.getByText("@john_doe")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("100 marks")).toBeInTheDocument();
      expect(screen.getByText("180 mins")).toBeInTheDocument();
      expect(screen.getByText("Test Institute")).toBeInTheDocument();
    });
  });
});
