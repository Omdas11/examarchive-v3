import type { Models } from "node-appwrite";

jest.mock("@/lib/appwrite", () => ({
  adminDatabases: jest.fn(),
  DATABASE_ID: "db",
  COLLECTION: { papers: "papers" },
  Query: {
    equal: jest.fn(),
    orderDesc: jest.fn(),
    limit: jest.fn(),
  },
}));

jest.mock("@/types", () => ({
  toPaper: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  getServerUser: jest.fn(),
}));
jest.mock("@/components/layout/MainLayout", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/layout/appSidebarItems", () => ({
  APP_SIDEBAR_ITEMS: [],
}));
jest.mock("@/components/PaperCard", () => ({
  PAPER_TYPE_COLORS: {},
}));
jest.mock("@/lib/syllabus-registry", () => ({
  findRegistryEntry: jest.fn().mockResolvedValue(undefined),
}));

import { adminDatabases } from "@/lib/appwrite";
import { toPaper } from "@/types";
import { generateMetadata } from "./page";
import { calculateSourceConfidence } from "./sourceConfidence";

describe("paper route generateMetadata", () => {
  it("returns OG/Twitter metadata when paper lookup succeeds", async () => {
    const getDocument = jest.fn().mockResolvedValue({} as Models.Document);
    (adminDatabases as jest.Mock).mockReturnValue({ getDocument });
    (toPaper as jest.Mock).mockReturnValue({
      id: "paper-1",
      title: "Data Structures",
      course_code: "CSC-201",
      course_name: "Computer Science",
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "paper-1" }),
    });

    expect(metadata.openGraph?.url).toBe(
      "https://www.examarchive.dev/paper/paper-1",
    );
    expect(metadata.twitter?.images).toEqual([
      "https://www.examarchive.dev/branding/logo.png",
    ]);
  });

  it("returns Paper Not Found title when lookup throws", async () => {
    const getDocument = jest.fn().mockRejectedValue(new Error("not found"));
    (adminDatabases as jest.Mock).mockReturnValue({ getDocument });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "missing-paper" }),
    });

    expect(metadata).toEqual({ title: "Paper Not Found" });
  });
});

describe("calculateSourceConfidence", () => {
  it("returns baseline for no related papers", () => {
    expect(calculateSourceConfidence(0)).toBe("Baseline");
  });

  it("returns medium for one related paper", () => {
    expect(calculateSourceConfidence(1)).toBe("Medium");
  });

  it("returns high for two or more related papers", () => {
    expect(calculateSourceConfidence(2)).toBe("High");
    expect(calculateSourceConfidence(5)).toBe("High");
  });
});
