import { render, screen } from "@testing-library/react";
import HomePage from "./page";
import React from "react";

jest.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, _key?: unknown, _options?: unknown) => fn,
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
jest.mock("@/components/DevProgressBar", () => {
  function MockDevProgressBar() {
    return <div />;
  }
  return MockDevProgressBar;
});
jest.mock("@/components/VisitorTracker", () => {
  function MockVisitorTracker() {
    return <div />;
  }
  return MockVisitorTracker;
});
jest.mock("@/components/FireParticles", () => {
  function MockFireParticles() {
    return <div />;
  }
  return MockFireParticles;
});

jest.mock("@/lib/appwrite", () => ({
  adminDatabases: jest.fn().mockReturnValue({
    listDocuments: jest.fn().mockResolvedValue({ total: 0, documents: [] }),
    getDocument: jest.fn().mockRejectedValue(new Error("not found")),
  }),
  adminUsers: jest.fn().mockReturnValue({
    list: jest.fn().mockResolvedValue({ total: 0 }),
  }),
  DATABASE_ID: "db",
  COLLECTION: {
    papers: "papers",
    syllabus: "syllabus",
    feedback: "feedback",
  },
  Query: {
    equal: jest.fn(),
    limit: jest.fn(),
    orderDesc: jest.fn(),
    offset: jest.fn(),
  },
}));

describe("homepage transparency row", () => {
  it("keeps a minimum height to reduce layout shift", async () => {
    const jsx = await HomePage();
    render(jsx);

    const transparency = screen.getByText(/Transparency:/i).closest("p");
    expect(transparency).toHaveClass("min-h-[1.5rem]");
  });
});
