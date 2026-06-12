jest.mock("node-appwrite", () => {
  const mockClientInstance = {
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
    setSession: jest.fn().mockReturnThis(),
  };

  const mockStorageInstance = {
    createFile: jest.fn().mockResolvedValue({}),
    deleteFile: jest.fn().mockResolvedValue({}),
  };

  return {
    Client: jest.fn().mockImplementation(() => mockClientInstance),
    Databases: jest.fn().mockImplementation(() => ({})),
    Storage: jest.fn().mockImplementation(() => mockStorageInstance),
    Users: jest.fn().mockImplementation(() => ({})),
    Account: jest.fn().mockImplementation(() => ({})),
    Functions: jest.fn().mockImplementation(() => ({})),
    ID: {
      unique: jest.fn().mockReturnValue("mocked-unique-id"),
    },
    Permission: {
      read: jest.fn((role) => `read:${role}`),
    },
    Role: {
      users: jest.fn().mockReturnValue("users-role"),
    },
  };
});

jest.mock("node-appwrite/file", () => ({
  InputFile: {
    fromBuffer: jest.fn().mockImplementation((buf, name) => ({ buf, name })),
  },
}));

describe("appwrite", () => {
  const originalEnv = process.env;
  let appwriteModule: any;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = "https://endpoint.example.com";
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = "proj123";
    process.env.APPWRITE_API_KEY = "key123";

    appwriteModule = require("./appwrite");

    const { Client, Storage } = require("node-appwrite");
    const mockClient = new Client();
    mockClient.setEndpoint.mockClear();
    mockClient.setProject.mockClear();
    mockClient.setKey.mockClear();
    mockClient.setSession.mockClear();
    
    const mockStorage = new Storage();
    mockStorage.createFile.mockClear();
    mockStorage.deleteFile.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("createAdminClient", () => {
    it("throws error if environment variables are missing", () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = "";
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = "";
      process.env.APPWRITE_API_KEY = "";

      const { createAdminClient } = require("./appwrite");
      expect(() => createAdminClient()).toThrow("Missing Appwrite environment variables");
    });

    it("creates, configures and returns an admin client singleton", () => {
      const { createAdminClient } = appwriteModule;
      const client1 = createAdminClient();
      const client2 = createAdminClient();

      expect(client1).toBe(client2);
      expect(client1.setEndpoint).toHaveBeenCalledWith("https://endpoint.example.com");
      expect(client1.setProject).toHaveBeenCalledWith("proj123");
      expect(client1.setKey).toHaveBeenCalledWith("key123");
    });
  });

  describe("createSessionClient", () => {
    it("throws error if endpoint or project ID is missing", () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = "";
      process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = "";

      const { createSessionClient } = require("./appwrite");
      expect(() => createSessionClient("session-token")).toThrow(
        "Missing Appwrite environment variables"
      );
    });

    it("creates, configures and returns a session client", () => {
      const { createSessionClient } = appwriteModule;
      const client = createSessionClient("session-token");

      expect(client).toBeDefined();
      expect(client.setEndpoint).toHaveBeenCalledWith("https://endpoint.example.com");
      expect(client.setProject).toHaveBeenCalledWith("proj123");
      expect(client.setSession).toHaveBeenCalledWith("session-token");
    });
  });

  describe("convenience service factories", () => {
    it("adminDatabases instantiates Databases", () => {
      const { adminDatabases } = appwriteModule;
      const db = adminDatabases();
      expect(db).toBeDefined();
    });

    it("adminStorage instantiates Storage", () => {
      const { adminStorage } = appwriteModule;
      const storage = adminStorage();
      expect(storage).toBeDefined();
    });

    it("adminUsers instantiates Users", () => {
      const { adminUsers } = appwriteModule;
      const users = adminUsers();
      expect(users).toBeDefined();
    });

    it("adminAccount instantiates Account", () => {
      const { adminAccount } = appwriteModule;
      const account = adminAccount();
      expect(account).toBeDefined();
    });

    it("adminFunctions instantiates Functions", () => {
      const { adminFunctions } = appwriteModule;
      const funcs = adminFunctions();
      expect(funcs).toBeDefined();
    });
  });

  describe("file storage helpers", () => {
    const fakeFile = {
      name: "sample.pdf",
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as unknown as File;

    it("uploadFileToAppwrite uploads files correctly", async () => {
      const { uploadFileToAppwrite } = appwriteModule;
      const { Storage } = require("node-appwrite");
      const storage = new Storage();
      const result = await uploadFileToAppwrite(fakeFile);
      expect(result.fileId).toBe("mocked-unique-id");
      expect(storage.createFile).toHaveBeenCalledWith("papers", "mocked-unique-id", expect.any(Object));
    });

    it("uploadAvatarToAppwrite uploads avatar with read permission correctly", async () => {
      const { uploadAvatarToAppwrite } = appwriteModule;
      const { Storage } = require("node-appwrite");
      const storage = new Storage();
      const result = await uploadAvatarToAppwrite(fakeFile);
      expect(result.fileId).toBe("mocked-unique-id");
      expect(result.bucketId).toBe("avatars");
      expect(storage.createFile).toHaveBeenCalledWith(
        "avatars",
        "mocked-unique-id",
        expect.any(Object),
        ["read:users-role"]
      );
    });

    it("deleteAvatarFromAppwrite deletes the file", async () => {
      const { deleteAvatarFromAppwrite } = appwriteModule;
      const { Storage } = require("node-appwrite");
      const storage = new Storage();
      await deleteAvatarFromAppwrite("avatar-id");
      expect(storage.deleteFile).toHaveBeenCalledWith("avatars", "avatar-id");
    });

    it("deleteFileFromAppwrite deletes the file", async () => {
      const { deleteFileFromAppwrite } = appwriteModule;
      const { Storage } = require("node-appwrite");
      const storage = new Storage();
      await deleteFileFromAppwrite("file-id");
      expect(storage.deleteFile).toHaveBeenCalledWith("papers", "file-id");
    });
  });

  describe("URL builders", () => {
    it("returns correct preview and download URLs", () => {
      const {
        getAvatarPreviewUrl,
        getAppwriteFileUrl,
        getAppwriteFileDownloadUrl,
        getNotesFileUrl,
        getNotesFileDownloadUrl,
      } = appwriteModule;
      expect(getAvatarPreviewUrl("avatar123", 100)).toBe("/api/files/avatars/avatar123?w=100");
      expect(getAvatarPreviewUrl("avatar123")).toBe("/api/files/avatars/avatar123?w=200");
      expect(getAppwriteFileUrl("file123")).toBe("/api/files/papers/file123");
      expect(getAppwriteFileDownloadUrl("file123")).toBe("/api/files/papers/file123?download=1");
      expect(getNotesFileUrl("notes123")).toBe("/api/files/notes/notes123");
      expect(getNotesFileDownloadUrl("notes123")).toBe("/api/files/notes/notes123?download=1");
    });
  });
});
