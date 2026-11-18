import { render, screen } from "@testing-library/react";
import HomePage from "./page";
import React from "react";

jest.mock("next/cache", () => ({
  // Pass the cached function through directly so tests exercise real logic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unstable_cache: (fn: any) => fn,
}));

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...rest
  }: Record<string, unknown>) {
    return React.createElement("a", { href, ...rest }, children as React.ReactNode);
  };
});

jest.mock("@/lib/auth", () => ({
  getServerUser: jest.fn().mockResolvedValue(null),
}));

// Homepage data now comes from D1 (migrate/cloudflare branch), not Appwrite.
jest.mock("@/lib/d1", () => ({
  getHomepageStatsD1: jest.fn().mockResolvedValue({
    papersTotal: 636,
    syllabusTotal: 517,
    usersTotal: 3,
    recentPapers: [],
    feedbackEntries: [],
  }),
}));

jest.mock("@/components/layout/MainLayout", () => {
  return function MockMainLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return React.createElement("div", { "data-testid": "main-layout" }, children);
  };
});

jest.mock("@/components/HomeSearch", () => {
  function MockHomeSearch() {
    return <div />;
  }
  return MockHomeSearch;
});
jest.mock("@/components/PaperCard", () => {
  function MockPaperCard() {
    return <div />;
  }
  return MockPaperCard;
});
jest.mock("@/components/AnimatedCounter", () => {
  function MockAnimatedCounter() {
    return <div />;
  }
  return MockAnimatedCounter;
});
jest.mock("@/components/VisitorTracker", () => {
  function MockVisitorTracker() {
    return <div />;
  }
  return MockVisitorTracker;
});

describe("homepage transparency row", () => {
  it("keeps a minimum height to reduce layout shift", async () => {
    const jsx = await HomePage();
    render(jsx);

    const transparency = screen.getByText(/Archive Status:/i).closest("p");
    expect(transparency).toHaveClass("min-h-[1.5rem]");
  });

  it("shows the D1 counts (papers, syllabi, students)", async () => {
    const jsx = await HomePage();
    render(jsx);

    expect(screen.getByText(/636 papers/i)).toBeTruthy();
    expect(screen.getByText(/517 syllabi/i)).toBeTruthy();
    expect(screen.getByText(/3 students/i)).toBeTruthy();
  });
});

describe("getHomepageStatsD1 — feedback mapping", () => {
  it("renders feedback entries from D1 without throwing", async () => {
    const { getHomepageStatsD1 } = jest.requireMock("@/lib/d1");
    (getHomepageStatsD1 as jest.Mock).mockResolvedValue({
      papersTotal: 636,
      syllabusTotal: 517,
      usersTotal: 3,
      recentPapers: [],
      feedbackEntries: [
        {
          id: "fb1",
          name: "Alice",
          university: "Assam University",
          text: "Great resource!",
        },
      ],
    });

    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByText(/Great resource!/i)).toBeTruthy();
    expect(screen.getByText(/Alice/i)).toBeTruthy();

    (getHomepageStatsD1 as jest.Mock).mockResolvedValue({
      papersTotal: 636,
      syllabusTotal: 517,
      usersTotal: 3,
      recentPapers: [],
      feedbackEntries: [],
    });
  });
});
