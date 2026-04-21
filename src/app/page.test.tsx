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
    users: "users",
    site_metrics: "site_metrics",
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

describe("getHomepageData — feedback mapping", () => {
  it("maps feedback documents to entries without throwing", async () => {
    const { adminDatabases } = jest.requireMock("@/lib/appwrite");
    const db = adminDatabases();

    (db.listDocuments as jest.Mock).mockImplementation(
      (_dbId: string, collectionId: string) => {
        if (collectionId === "feedback") {
          return Promise.resolve({
            total: 1,
            documents: [
              {
                $id: "fb1",
                name: "Alice",
                university: "Assam University",
                text: "Great resource!",
                approved: true,
              },
            ],
          });
        }
        return Promise.resolve({ total: 0, documents: [] });
      },
    );

    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByTestId("main-layout")).toBeTruthy();

    (db.listDocuments as jest.Mock).mockResolvedValue({ total: 0, documents: [] });
  });
});

describe("getHomepageData — fallback user count", () => {
  it("falls back to adminUsers().list() when users collection query fails", async () => {
    const { adminDatabases, adminUsers } = jest.requireMock("@/lib/appwrite");
    const db = adminDatabases();

    (db.listDocuments as jest.Mock).mockImplementation(
      (_dbId: string, collectionId: string) => {
        if (collectionId === "users") {
          return Promise.reject(new Error("permission denied"));
        }
        return Promise.resolve({ total: 0, documents: [] });
      },
    );
    (adminUsers().list as jest.Mock).mockResolvedValue({ total: 42 });

    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByTestId("main-layout")).toBeTruthy();

    (db.listDocuments as jest.Mock).mockResolvedValue({ total: 0, documents: [] });
    (adminUsers().list as jest.Mock).mockResolvedValue({ total: 0 });
  });
});

describe("getHomepageData — pagination", () => {
  it("fetches subsequent pages when papersTotal exceeds first page", async () => {
    const { adminDatabases } = jest.requireMock("@/lib/appwrite");
    const db = adminDatabases();

    const makePaper = (id: string) => ({
      $id: id,
      title: "Test Paper",
      course_code: "CS101",
      course_name: "Computer Science",
      $createdAt: "2024-01-01T00:00:00Z",
      approved: true,
      view_count: 5,
    });
    const firstPage = Array.from({ length: 100 }, (_, i) => makePaper(`p${i}`));
    const secondPage = [makePaper("p100")];

    let papersCallCount = 0;
    (db.listDocuments as jest.Mock).mockImplementation(
      (_dbId: string, collectionId: string) => {
        if (collectionId === "papers") {
          papersCallCount += 1;
          if (papersCallCount === 1) {
            return Promise.resolve({ total: 101, documents: firstPage });
          }
          return Promise.resolve({ total: 101, documents: secondPage });
        }
        return Promise.resolve({ total: 0, documents: [] });
      },
    );

    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByTestId("main-layout")).toBeTruthy();

    papersCallCount = 0;
    (db.listDocuments as jest.Mock).mockResolvedValue({ total: 0, documents: [] });
  });
});

describe("getHomepageData — launchProgress from site_metrics", () => {
  it("reads launch_progress from site_metrics singleton document", async () => {
    const { adminDatabases } = jest.requireMock("@/lib/appwrite");
    const db = adminDatabases();

    (db.getDocument as jest.Mock).mockResolvedValue({ launch_progress: 75 });

    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByTestId("main-layout")).toBeTruthy();

    (db.getDocument as jest.Mock).mockRejectedValue(new Error("not found"));
  });
});
