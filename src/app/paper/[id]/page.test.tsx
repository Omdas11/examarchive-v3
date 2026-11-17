import { render, screen } from "@testing-library/react";
import PaperPage from "./page";
import React from "react";

jest.mock("next/cache", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unstable_cache: (fn: any) => fn,
}));

jest.mock("@/lib/auth", () => ({
  getServerUser: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/d1", () => ({
  getPaperD1: jest.fn().mockResolvedValue({
    id: "p1",
    title: "Algorithms",
    course_code: "CS101",
    course_name: "Computer Science",
    year: 2024,
    semester: "",
    exam_type: "",
    department: "",
    file_url: "https://example.com/p1.pdf",
    uploaded_by: "",
    approved: true,
    created_at: "2024-01-01T00:00:00Z",
  }),
  getRelatedPapersD1: jest.fn().mockResolvedValue([]),
  getPaperCountsD1: jest.fn().mockResolvedValue({ view_count: 0, download_count: 0 }),
}));

jest.mock("@/components/layout/MainLayout", () => {
  return function MockMainLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return <div data-testid="main-layout">{children}</div>;
  };
});

jest.mock("@/components/layout/appSidebarItems", () => ({
  APP_SIDEBAR_ITEMS: [],
}));

jest.mock("@/data/syllabus-registry", () => ({
  findByPaperCode: jest.fn().mockReturnValue({
    paper_code: "CS101",
    category: "DSC",
    credits: 4,
    units: [{ unit: "1", name: "Intro" }],
  }),
}));

jest.mock("next/link", () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

describe("PaperPage Component", () => {
  it("renders paper details correctly", async () => {
    const jsx = await PaperPage({ params: Promise.resolve({ id: "p1" }) });
    render(jsx);

    expect(screen.getByText("Algorithms")).toBeInTheDocument();
    expect(screen.getByText("CS101")).toBeInTheDocument();
    expect(screen.getByText("Version History")).toBeInTheDocument();
    expect(screen.getByText("Syllabus Insights")).toBeInTheDocument();
  });

  it("renders 404 when paper is missing", async () => {
    const { getPaperD1 } = jest.requireMock("@/lib/d1");
    getPaperD1.mockResolvedValueOnce(null);

    const jsx = await PaperPage({ params: Promise.resolve({ id: "missing" }) });
    render(jsx);

    expect(screen.getByText("Paper Not Found")).toBeInTheDocument();
  });
});
