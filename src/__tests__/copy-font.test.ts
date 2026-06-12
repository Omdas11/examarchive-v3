/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for scripts/copy-font.js
 *
 * We dynamically require() the script so fs/path are mockable at the module level.
 */

jest.mock('fs');
jest.mock('path');

function setupMocks() {
  jest.resetModules();
  const fsMock = jest.requireMock('fs');
  const pathMock = jest.requireMock('path');
  (pathMock.join as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));
  return { fsMock, pathMock };
}

function runScript() {
  return require('../../scripts/copy-font.js');
}

describe('scripts/copy-font.js', () => {
  let originalConsoleLog: any;
  let originalConsoleWarn: any;
  let originalConsoleError: any;

  beforeEach(() => {
    // Silence console output during tests
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  it('copies font when source exists and dest directory does not exist', () => {
    const { fsMock } = setupMocks();
    (fsMock.existsSync as jest.Mock)
      .mockReturnValueOnce(true)   // source exists
      .mockReturnValueOnce(false); // destDir does not exist
    (fsMock.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fsMock.copyFileSync as jest.Mock).mockReturnValue(undefined);

    runScript();

    expect(fsMock.mkdirSync).toHaveBeenCalled();
    expect(fsMock.copyFileSync).toHaveBeenCalled();
  });

  it('copies font when source exists and dest directory already exists', () => {
    const { fsMock } = setupMocks();
    (fsMock.existsSync as jest.Mock)
      .mockReturnValueOnce(true)  // source exists
      .mockReturnValueOnce(true); // destDir exists
    (fsMock.copyFileSync as jest.Mock).mockReturnValue(undefined);

    runScript();

    expect(fsMock.mkdirSync).not.toHaveBeenCalled();
    expect(fsMock.copyFileSync).toHaveBeenCalled();
  });

  it('skips copy when source does not exist', () => {
    const { fsMock } = setupMocks();
    (fsMock.existsSync as jest.Mock).mockReturnValueOnce(false); // source does not exist

    runScript();

    expect(fsMock.copyFileSync).not.toHaveBeenCalled();
  });

  it('sets exitCode to 1 when copyFileSync throws', () => {
    const { fsMock } = setupMocks();
    (fsMock.existsSync as jest.Mock)
      .mockReturnValueOnce(true)  // source exists
      .mockReturnValueOnce(true); // destDir exists
    (fsMock.copyFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const originalExitCode = process.exitCode;
    runScript();

    expect(process.exitCode).toBe(1);
    // Restore
    process.exitCode = originalExitCode;
  });
});
