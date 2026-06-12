/**
 * @jest-environment node
 */
import { POST } from "../route";
import { NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases } from "@/lib/appwrite";

// Mock Auth
jest.mock("@/lib/auth", () => ({
  getServerUser: jest.fn(),
}));

// Mock Appwrite
jest.mock("@/lib/appwrite", () => ({
  adminDatabases: jest.fn(),
  DATABASE_ID: "test-db",
  COLLECTION: {
    papers: "test-papers",
    users: "test-users",
  },
  Query: {
    limit: jest.fn().mockImplementation((val) => `limit(${val})`),
    offset: jest.fn().mockImplementation((val) => `offset(${val})`),
    equal: jest.fn().mockImplementation((field, val) => `equal(${field}, ${val})`),
  },
}));

describe("devtool api", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("returns 403 for non-founders", async () => {
    (getServerUser as jest.Mock).mockResolvedValue({ role: "student" });
    
    const req = new NextRequest("http://localhost/api/devtool", {
      method: "POST",
      body: JSON.stringify({ action: "reset_users_xo" }),
    });
    const res = await POST(req);
    
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing action", async () => {
    (getServerUser as jest.Mock).mockResolvedValue({ role: "founder" });
    
    const req = new NextRequest("http://localhost/api/devtool", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid json", async () => {
    (getServerUser as jest.Mock).mockResolvedValue({ role: "founder" });
    
    const req = new NextRequest("http://localhost/api/devtool", {
      method: "POST",
      body: "invalid json",
    });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
  });

  it("executes valid actions for founders", async () => {
    (getServerUser as jest.Mock).mockResolvedValue({ role: "founder" });
    
    const mockDb = {
      listDocuments: jest.fn().mockResolvedValue({ documents: [] }),
    };
    (adminDatabases as jest.Mock).mockReturnValue(mockDb);
    
    const req = new NextRequest("http://localhost/api/devtool", {
      method: "POST",
      body: JSON.stringify({ action: "clear_pending_uploads" }),
    });
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
