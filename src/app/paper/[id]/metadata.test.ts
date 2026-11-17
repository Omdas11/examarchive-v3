jest.mock("next/cache", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unstable_cache: (fn: any) => fn,
}));

jest.mock("@/lib/d1", () => ({
  getPaperD1: jest.fn(),
  getRelatedPapersD1: jest.fn(),
  getPaperCountsD1: jest.fn(),
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

import { getPaperD1 } from "@/lib/d1";
import { generateMetadata } from "./page";

describe("paper route generateMetadata", () => {
  it("returns OG/Twitter metadata when paper lookup succeeds", async () => {
    (getPaperD1 as jest.Mock).mockResolvedValue({
      id: "paper-1",
      title: "Data Structures",
      course_code: "CSC-201",
      course_name: "Computer Science",
      year: 2024,
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
    (getPaperD1 as jest.Mock).mockResolvedValueOnce(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "missing-paper" }),
    });

    expect(metadata).toEqual({ title: "Paper Not Found" });
  });
});
