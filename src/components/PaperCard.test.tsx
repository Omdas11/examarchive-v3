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
    // Subtitle combines code and year so same-code papers from different
    // years don't read as duplicates; the year pill shows it as well.
    expect(screen.getByText("CS101 · 2024")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  describe("download button (direct link, no CAPTCHA gate)", () => {
    // Downloads are plain direct links — the hCaptcha gate was removed
    // (2026-11-14) after its secret proved wrong and it blocked every
    // download. A paper with a bucket file links to the file route;
    // a file_url-only paper links straight to the external file.
    it("renders a direct link to the file route for a paper with a file", () => {
      render(<PaperCard paper={{ ...basePaper, file_id: "file_456", file_url: "https://example.com/test.pdf" }} />);
      const downloadLink = screen.getByTitle("Download PDF");
      expect(downloadLink.tagName).toBe("A");
      expect(downloadLink).toHaveAttribute("href", "/api/files/papers/file_456");
    });

    it("links directly for a file_url-only paper (external file, no bucket id)", () => {
      render(<PaperCard paper={{ ...basePaper, file_url: "https://example.com/test.pdf" }} />);
      const downloadLink = screen.getByTitle("Download PDF");
      expect(downloadLink.tagName).toBe("A");
      expect(downloadLink).toHaveAttribute("href", "https://example.com/test.pdf?download=1");
    });

    it("handles missing url gracefully", () => {
      render(<PaperCard paper={basePaper} />);
      // No file: the Download action renders disabled ("PDF unavailable")
      // instead of a dead href="#" link.
      expect(screen.getByText("PDF unavailable")).toBeInTheDocument();
      expect(screen.queryByTitle("Download PDF")).not.toBeInTheDocument();
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

  describe("Verified badge", () => {
    it("shows a Verified badge for admin-approved papers", () => {
      render(<PaperCard paper={{ ...basePaper, approved: true }} />);
      const badge = screen.getByText("Verified");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute(
        "title",
        "Reviewed and approved by the ExamArchive admin team",
      );
    });

    it("hides the Verified badge for unapproved papers", () => {
      render(<PaperCard paper={{ ...basePaper, approved: false }} />);
      expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    });
  });
});
