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
  it("shows referral and electron policy sections", async () => {
    const jsx = await AboutPage();
    render(jsx);

    expect(screen.getByText("Electrons & Referrals")).toBeInTheDocument();
    expect(screen.getByText("Referral Rules")).toBeInTheDocument();
    expect(screen.getByText("XO → Electron Policy")).toBeInTheDocument();
    expect(screen.getByText("Successful referral cap per referrer")).toBeInTheDocument();
    expect(screen.getByText("Cosmetics & Role Assignment")).toBeInTheDocument();
    expect(screen.getByText("Direct referrals only")).toBeInTheDocument();
  });
});
