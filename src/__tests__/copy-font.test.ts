/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for scripts/copy-font.js
 *
 * We dynamically require() the script so fs/path are mockable at the module level.
 */

const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('path');

beforeEach(() => {
  jest.resetAllMocks();
  // Default: path.join just concatenates with /
  (path.join as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));
  // Silence console output during tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function runScript() {
  // Clear module cache so script re-executes on each call
  jest.resetModules();
  jest.mock('fs');
  jest.mock('path');
  (path.join as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));
  return require('../../scripts/copy-font.js');
}

describe('scripts/copy-font.js', () => {
  it('copies font when source exists and dest directory does not exist', () => {
    (fs.existsSync as jest.Mock)
      .mockReturnValueOnce(true)   // source exists
      .mockReturnValueOnce(false); // destDir does not exist
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.copyFileSync as jest.Mock).mockReturnValue(undefined);

    runScript();

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.copyFileSync).toHaveBeenCalled();
  });

  it('copies font when source exists and dest directory already exists', () => {
    (fs.existsSync as jest.Mock)
      .mockReturnValueOnce(true)  // source exists
      .mockReturnValueOnce(true); // destDir exists
    (fs.copyFileSync as jest.Mock).mockReturnValue(undefined);

    runScript();

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.copyFileSync).toHaveBeenCalled();
  });

  it('skips copy when source does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValueOnce(false); // source does not exist

    runScript();

    expect(fs.copyFileSync).not.toHaveBeenCalled();
  });

  it('sets exitCode to 1 when copyFileSync throws', () => {
    (fs.existsSync as jest.Mock)
      .mockReturnValueOnce(true)  // source exists
      .mockReturnValueOnce(true); // destDir exists
    (fs.copyFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const originalExitCode = process.exitCode;
    runScript();

    expect(process.exitCode).toBe(1);
    // Restore
    process.exitCode = originalExitCode;
  });
});
