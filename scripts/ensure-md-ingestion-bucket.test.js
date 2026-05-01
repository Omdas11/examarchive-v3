jest.mock('node-appwrite', () => {
  const getBucket = jest.fn();
  const createBucket = jest.fn();
  const storageInstance = { getBucket, createBucket };

  return {
    Client: jest.fn().mockImplementation(() => ({
      setEndpoint: jest.fn().mockReturnThis(),
      setProject: jest.fn().mockReturnThis(),
      setKey: jest.fn().mockReturnThis(),
    })),
    Storage: jest.fn().mockImplementation(() => storageInstance),
    Compression: { None: 'none' },
    __storageInstance: storageInstance,
  };
});

jest.mock('./v2/appwrite-schema-setup', () => ({
  loadAppwriteEnv: jest.fn(() => ({
    endpoint: 'https://example.com/v1',
    projectId: 'project',
    apiKey: 'key',
  })),
}));

const appwrite = require('node-appwrite');
const { ensureMdIngestionBucket } = require('./ensure-md-ingestion-bucket');

describe('ensure-md-ingestion-bucket', () => {
  beforeEach(() => {
    appwrite.__storageInstance.getBucket.mockReset();
    appwrite.__storageInstance.createBucket.mockReset();
  });

  test('creates missing buckets when Appwrite returns 404', async () => {
    appwrite.__storageInstance.getBucket.mockRejectedValue({ code: 404, message: 'not found' });

    const results = await ensureMdIngestionBucket();

    expect(appwrite.__storageInstance.createBucket).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { bucketId: expect.any(String), created: true },
      { bucketId: expect.any(String), created: true },
    ]);
  });

  test('skips creation when buckets already exist', async () => {
    appwrite.__storageInstance.getBucket.mockResolvedValue({});

    const results = await ensureMdIngestionBucket();

    expect(appwrite.__storageInstance.createBucket).not.toHaveBeenCalled();
    expect(results).toEqual([
      { bucketId: 'examarchive-syllabus-md-ingestion', created: false },
      { bucketId: 'examarchive_question_ingest_assets', created: false },
    ]);
  });



  test('handles create race when bucket is created concurrently', async () => {
    appwrite.__storageInstance.getBucket.mockRejectedValue({ code: 404, message: 'not found' });
    appwrite.__storageInstance.createBucket.mockRejectedValue({ code: 409, message: 'already exists' });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const results = await ensureMdIngestionBucket();

      expect(results).toEqual([
        { bucketId: 'examarchive-syllabus-md-ingestion', created: false },
        { bucketId: 'examarchive_question_ingest_assets', created: false },
      ]);
      expect(appwrite.__storageInstance.createBucket).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenCalledWith(
        '[exists-race] bucket examarchive-syllabus-md-ingestion already created by another process'
      );
      expect(logSpy).toHaveBeenCalledWith(
        '[exists-race] bucket examarchive_question_ingest_assets already created by another process'
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  test('throws for non-not-found errors', async () => {
    appwrite.__storageInstance.getBucket.mockRejectedValue({ code: 500, message: 'boom' });

    await expect(ensureMdIngestionBucket()).rejects.toEqual({ code: 500, message: 'boom' });
  });
});
