import { render, screen } from "@testing-library/react";
import React from "react";
import AboutPage from "./page";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...rest
  }: React.ComponentProps<"a">) {
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

jest.mock("@/lib/appwrite", () => ({
  adminDatabases: jest.fn().mockReturnValue({
    listDocuments: jest.fn().mockResolvedValue({ total: 0 }),
  }),
  DATABASE_ID: "db",
  COLLECTION: {
    papers: "papers",
    syllabus: "syllabus",
    users: "users",
  },
  Query: {
    equal: jest.fn(),
    limit: jest.fn(),
  },
}));

describe("About page progression content", () => {
  it("shows credit system and policy sections", async () => {
    const jsx = await AboutPage();
    render(jsx);

    expect(screen.getByText("Credits System")).toBeInTheDocument();
    expect(screen.getByText("How to Get Credits")).toBeInTheDocument();
    expect(screen.getByText("Credit Policy")).toBeInTheDocument();
    expect(screen.getByText("AI PDF Generation")).toBeInTheDocument();
    expect(screen.getByText("Cosmetics & Role Assignment")).toBeInTheDocument();
  });
});
