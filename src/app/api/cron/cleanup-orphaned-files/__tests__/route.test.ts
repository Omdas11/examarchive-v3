/**
 * @jest-environment node
 */
import { GET } from "../route";
import { NextRequest } from "next/server";
import { adminStorage } from "@/lib/appwrite";

// Mock Appwrite
jest.mock("@/lib/appwrite", () => ({
  adminDatabases: jest.fn(),
  adminStorage: jest.fn(),
  DATABASE_ID: "test-db",
  COLLECTION: {
    papers: "test-papers",
    uploads: "test-uploads",
    ai_generation_jobs: "test-jobs",
  },
  BUCKET_ID: "test-bucket",
  Query: {
    limit: jest.fn().mockImplementation((val) => `limit(${val})`),
    orderAsc: jest.fn().mockImplementation((val) => `orderAsc(${val})`),
    cursorAfter: jest.fn().mockImplementation((val) => `cursorAfter(${val})`),
    equal: jest.fn().mockImplementation((key, val) => `equal(${key}, ${val})`),
    select: jest.fn().mockImplementation((val) => `select(${val})`),
  },
}));

describe("cleanup-orphaned-files cron", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    
    const req = new NextRequest("http://localhost/api/cron/cleanup-orphaned-files");
    const res = await GET(req);
    
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET is not configured/);
  });

  it("returns 401 Unauthorized for invalid Bearer token", async () => {
    process.env.CRON_SECRET = "supersecret";
    
    const req = new NextRequest("http://localhost/api/cron/cleanup-orphaned-files", {
      headers: { authorization: "Bearer wrongtoken" },
    });
    const res = await GET(req);
    
    expect(res.status).toBe(401);
  });

  it("processes files correctly with valid Bearer token", async () => {
    process.env.CRON_SECRET = "supersecret";
    
    const mockStorage = {
      listFiles: jest.fn().mockResolvedValue({ files: [] }), // Empty mock, stops immediately
    };
    (adminStorage as jest.Mock).mockReturnValue(mockStorage);
    
    const req = new NextRequest("http://localhost/api/cron/cleanup-orphaned-files", {
      headers: { authorization: "Bearer supersecret" },
    });
    const res = await GET(req);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
