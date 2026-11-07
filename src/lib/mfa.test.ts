/**
 * @jest-environment node
 */
import {
  isValidOtp,
  resolveMfaFactor,
  isMfaRequiredError,
  isNotFoundError,
  resolveSafeNextPath,
  encodeMfaPending,
  decodeMfaPending,
  toFriendlyMfaError,
  checkSessionNeedsMfa,
  startLoginChallenge,
  completeLoginChallenge,
  getMfaStatus,
  startTotpEnrollment,
  verifyTotpEnrollment,
  generateMfaRecoveryCodes,
  enableMfa,
  disableMfa,
  type MfaAccountClient,
  type MfaPendingState,
} from "./mfa";

/** Build a fake Appwrite Account client with jest.fn() for every MFA method. */
function fakeAccount(overrides: Partial<MfaAccountClient> = {}): MfaAccountClient & {
  __fns: Record<string, jest.Mock>;
} {
  const fns: Record<string, jest.Mock> = {
    get: jest.fn().mockResolvedValue({ $id: "user-1", mfa: false }),
    listMFAFactors: jest.fn().mockResolvedValue({
      totp: false,
      phone: false,
      email: false,
      recoveryCode: false,
      custom: false,
    }),
    updateMFA: jest.fn().mockResolvedValue({}),
    createMFAAuthenticator: jest.fn().mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/ExamArchive:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ExamArchive",
    }),
    updateMFAAuthenticator: jest.fn().mockResolvedValue({}),
    deleteMFAAuthenticator: jest.fn().mockResolvedValue({}),
    createMFAChallenge: jest.fn().mockResolvedValue({
      $id: "challenge-1",
      userId: "user-1",
      expire: "2026-11-07T20:00:00.000Z",
    }),
    updateMFAChallenge: jest.fn().mockResolvedValue({
      $id: "session-1",
      factors: ["password", "totp"],
      secret: "secret-abc",
    }),
    createMFARecoveryCodes: jest.fn().mockResolvedValue({
      recoveryCodes: ["AAAAA-BBBBB", "CCCCC-DDDDD"],
    }),
  };
  const account = {
    get: fns.get,
    listMFAFactors: fns.listMFAFactors,
    updateMFA: fns.updateMFA,
    createMFAAuthenticator: fns.createMFAAuthenticator,
    updateMFAAuthenticator: fns.updateMFAAuthenticator,
    deleteMFAAuthenticator: fns.deleteMFAAuthenticator,
    createMFAChallenge: fns.createMFAChallenge,
    updateMFAChallenge: fns.updateMFAChallenge,
    createMFARecoveryCodes: fns.createMFARecoveryCodes,
    ...overrides,
    __fns: fns,
  } as unknown as MfaAccountClient & { __fns: Record<string, jest.Mock> };
  return account;
}

function mfaRequiredError(): Error {
  const err = new Error("user_more_factors_required") as Error & {
    type: string;
    code: number;
  };
  err.type = "user_more_factors_required";
  err.code = 401;
  return err;
}

describe("isValidOtp", () => {
  it("accepts exactly 6 digits", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp(" 123456 ")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("1234567")).toBe(false);
    expect(isValidOtp("12345a")).toBe(false);
    expect(isValidOtp("")).toBe(false);
    expect(isValidOtp("AAAAA-BBBBB")).toBe(false);
  });
});

describe("resolveMfaFactor", () => {
  it("routes 6-digit codes to totp", () => {
    expect(resolveMfaFactor("123456")).toBe("totp");
  });

  it("routes anything else to recoverycode", () => {
    expect(resolveMfaFactor("AAAAA-BBBBB")).toBe("recoverycode");
    expect(resolveMfaFactor("recoverycode123")).toBe("recoverycode");
  });
});

describe("isMfaRequiredError", () => {
  it("detects the Appwrite error type", () => {
    expect(isMfaRequiredError(mfaRequiredError())).toBe(true);
    expect(
      isMfaRequiredError(new Error("something user_more_factors_required happened")),
    ).toBe(true);
  });

  it("rejects other errors", () => {
    expect(isMfaRequiredError(new Error("Invalid credentials"))).toBe(false);
    expect(isMfaRequiredError(null)).toBe(false);
    expect(isMfaRequiredError("user_more_factors_required")).toBe(false);
  });
});

describe("isNotFoundError", () => {
  it("detects 404 codes and messages", () => {
    expect(isNotFoundError({ code: 404 })).toBe(true);
    expect(isNotFoundError(new Error("Document not found"))).toBe(true);
    expect(isNotFoundError(new Error("boom"))).toBe(false);
  });
});

describe("resolveSafeNextPath", () => {
  it("allows relative paths", () => {
    expect(resolveSafeNextPath("/dashboard")).toBe("/dashboard");
    expect(resolveSafeNextPath("/")).toBe("/");
  });

  it("allows trusted examarchive.dev URLs", () => {
    expect(resolveSafeNextPath("https://examarchive.dev/dashboard")).toBe(
      "https://examarchive.dev/dashboard",
    );
    expect(resolveSafeNextPath("https://syllabus.examarchive.dev/")).toBe(
      "https://syllabus.examarchive.dev/",
    );
  });

  it("rejects everything else", () => {
    expect(resolveSafeNextPath("https://evil.example.com/")).toBe("/");
    expect(resolveSafeNextPath("javascript:alert(1)")).toBe("/");
    expect(resolveSafeNextPath(null)).toBe("/");
    expect(resolveSafeNextPath(undefined)).toBe("/");
    expect(resolveSafeNextPath("")).toBe("/");
  });
});

describe("encodeMfaPending / decodeMfaPending", () => {
  const state: MfaPendingState = {
    challengeId: "challenge-1",
    sessionSecret: "secret-abc",
    userId: "user-1",
    factor: "totp",
    next: "/dashboard",
    expiresAt: "2026-11-07T20:00:00.000Z",
  };

  it("round-trips valid state", () => {
    expect(decodeMfaPending(encodeMfaPending(state))).toEqual(state);
  });

  it("rejects garbage", () => {
    expect(decodeMfaPending(null)).toBeNull();
    expect(decodeMfaPending("")).toBeNull();
    expect(decodeMfaPending("not json")).toBeNull();
    expect(decodeMfaPending(JSON.stringify({ challengeId: "x" }))).toBeNull();
    expect(
      decodeMfaPending(
        JSON.stringify({ ...state, factor: "sms" }),
      ),
    ).toBeNull();
    expect(
      decodeMfaPending(JSON.stringify({ ...state, expiresAt: "nope" })),
    ).toBeNull();
  });
});

describe("toFriendlyMfaError", () => {
  it("maps common Appwrite messages", () => {
    expect(toFriendlyMfaError(new Error("Invalid `otp` param"))).toMatch(
      /did not work/,
    );
    expect(toFriendlyMfaError(new Error("Token expired"))).toMatch(/expired/);
    expect(toFriendlyMfaError(new Error("Rate limit exceeded"))).toMatch(
      /Too many attempts/,
    );
  });

  it("falls back to a generic message", () => {
    expect(toFriendlyMfaError(new Error("weird internal thing"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(toFriendlyMfaError(undefined)).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("checkSessionNeedsMfa", () => {
  it("returns the user id when the session is complete", async () => {
    const account = fakeAccount();
    await expect(checkSessionNeedsMfa(account)).resolves.toEqual({
      needsMfa: false,
      userId: "user-1",
    });
  });

  it("detects the MFA-required error", async () => {
    const account = fakeAccount({
      get: jest.fn().mockRejectedValue(mfaRequiredError()),
    });
    await expect(checkSessionNeedsMfa(account)).resolves.toEqual({
      needsMfa: true,
    });
  });

  it("rethrows any other error (login fails closed)", async () => {
    const account = fakeAccount({
      get: jest.fn().mockRejectedValue(new Error("network down")),
    });
    await expect(checkSessionNeedsMfa(account)).rejects.toThrow("network down");
  });
});

describe("startLoginChallenge", () => {
  it("prefers the authenticator app when available", async () => {
    const account = fakeAccount({
      listMFAFactors: jest.fn().mockResolvedValue({
        totp: true,
        phone: false,
        email: false,
        recoveryCode: true,
        custom: false,
      }),
    });
    const res = await startLoginChallenge(account);
    expect(account.__fns.createMFAChallenge).toHaveBeenCalledWith({
      factor: "totp",
    });
    expect(res.factor).toBe("totp");
    expect(res.challengeId).toBe("challenge-1");
  });

  it("falls back to recovery code when no authenticator is set", async () => {
    const account = fakeAccount({
      listMFAFactors: jest.fn().mockResolvedValue({
        totp: false,
        phone: false,
        email: false,
        recoveryCode: true,
        custom: false,
      }),
    });
    const res = await startLoginChallenge(account);
    expect(account.__fns.createMFAChallenge).toHaveBeenCalledWith({
      factor: "recoverycode",
    });
    expect(res.factor).toBe("recoverycode");
  });
});

describe("completeLoginChallenge", () => {
  it("rejects an empty code without calling Appwrite", async () => {
    const account = fakeAccount();
    await expect(
      completeLoginChallenge(account, "challenge-1", "   "),
    ).rejects.toThrow("Enter the code");
    expect(account.__fns.updateMFAChallenge).not.toHaveBeenCalled();
  });

  it("completes the challenge and returns the session", async () => {
    const account = fakeAccount();
    const res = await completeLoginChallenge(account, "challenge-1", "123456");
    expect(account.__fns.updateMFAChallenge).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      otp: "123456",
    });
    expect(res.factors).toEqual(["password", "totp"]);
  });
});

describe("getMfaStatus", () => {
  it("reports enabled + totp from account state", async () => {
    const account = fakeAccount({
      get: jest.fn().mockResolvedValue({ $id: "user-1", mfa: true }),
      listMFAFactors: jest.fn().mockResolvedValue({
        totp: true,
        phone: false,
        email: false,
        recoveryCode: true,
        custom: false,
      }),
    });
    await expect(getMfaStatus(account)).resolves.toEqual({
      enabled: true,
      totpEnabled: true,
    });
  });

  it("reports disabled for a plain account", async () => {
    await expect(getMfaStatus(fakeAccount())).resolves.toEqual({
      enabled: false,
      totpEnabled: false,
    });
  });
});

describe("startTotpEnrollment", () => {
  it("returns secret, uri and a QR data URL", async () => {
    const account = fakeAccount();
    const res = await startTotpEnrollment(account, async () =>
      "data:image/png;base64,QR",
    );
    expect(account.__fns.createMFAAuthenticator).toHaveBeenCalledWith({
      type: "totp",
    });
    expect(res.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(res.uri).toContain("otpauth://totp/");
    expect(res.qrDataUrl).toBe("data:image/png;base64,QR");
  });

  it("still returns secret + uri when QR rendering fails", async () => {
    const account = fakeAccount();
    const res = await startTotpEnrollment(account, async () => null);
    expect(res.qrDataUrl).toBeNull();
    expect(res.secret).toBe("JBSWY3DPEHPK3PXP");
  });
});

describe("verifyTotpEnrollment", () => {
  it("rejects a malformed code before calling Appwrite", async () => {
    const account = fakeAccount();
    await expect(verifyTotpEnrollment(account, "123")).rejects.toThrow(
      "6-digit code",
    );
    expect(account.__fns.updateMFAAuthenticator).not.toHaveBeenCalled();
  });

  it("verifies a well-formed code and does NOT enable MFA yet", async () => {
    const account = fakeAccount();
    await expect(
      verifyTotpEnrollment(account, "123456"),
    ).resolves.toEqual({ ok: true });
    expect(account.__fns.updateMFAAuthenticator).toHaveBeenCalledWith({
      type: "totp",
      otp: "123456",
    });
    expect(account.__fns.updateMFA).not.toHaveBeenCalled();
  });
});

describe("generateMfaRecoveryCodes", () => {
  it("returns the generated codes", async () => {
    await expect(
      generateMfaRecoveryCodes(fakeAccount()),
    ).resolves.toEqual(["AAAAA-BBBBB", "CCCCC-DDDDD"]);
  });

  it("throws when Appwrite returns no codes", async () => {
    const account = fakeAccount({
      createMFARecoveryCodes: jest.fn().mockResolvedValue({ recoveryCodes: [] }),
    });
    await expect(generateMfaRecoveryCodes(account)).rejects.toThrow(
      "Could not generate recovery codes",
    );
  });
});

describe("enableMfa", () => {
  it("enables MFA enforcement", async () => {
    const account = fakeAccount();
    await expect(enableMfa(account)).resolves.toEqual({ ok: true });
    expect(account.__fns.updateMFA).toHaveBeenCalledWith({ mfa: true });
  });
});

describe("disableMfa", () => {
  it("proves possession with a TOTP challenge, then removes + disables", async () => {
    const account = fakeAccount();
    await expect(disableMfa(account, "123456")).resolves.toEqual({ ok: true });
    expect(account.__fns.createMFAChallenge).toHaveBeenCalledWith({
      factor: "totp",
    });
    expect(account.__fns.updateMFAChallenge).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      otp: "123456",
    });
    expect(account.__fns.deleteMFAAuthenticator).toHaveBeenCalledWith({
      type: "totp",
    });
    expect(account.__fns.updateMFA).toHaveBeenCalledWith({ mfa: false });
  });

  it("accepts a recovery code instead of a TOTP code", async () => {
    const account = fakeAccount();
    await expect(disableMfa(account, "AAAAA-BBBBB")).resolves.toEqual({
      ok: true,
    });
    expect(account.__fns.createMFAChallenge).toHaveBeenCalledWith({
      factor: "recoverycode",
    });
  });

  it("still disables when the authenticator is already gone", async () => {
    const account = fakeAccount({
      deleteMFAAuthenticator: jest
        .fn()
        .mockRejectedValue(Object.assign(new Error("not found"), { code: 404 })),
    });
    await expect(disableMfa(account, "123456")).resolves.toEqual({ ok: true });
    expect(account.__fns.updateMFA).toHaveBeenCalledWith({ mfa: false });
  });

  it("fails closed on a wrong code (MFA stays on)", async () => {
    const account = fakeAccount({
      updateMFAChallenge: jest
        .fn()
        .mockRejectedValue(new Error("Invalid `otp` param")),
    });
    await expect(disableMfa(account, "000000")).rejects.toThrow(
      "Invalid `otp` param",
    );
    expect(account.__fns.deleteMFAAuthenticator).not.toHaveBeenCalled();
    expect(account.__fns.updateMFA).not.toHaveBeenCalled();
  });

  it("rejects an empty code", async () => {
    const account = fakeAccount();
    await expect(disableMfa(account, "   ")).rejects.toThrow(
      "Enter the code",
    );
    expect(account.__fns.createMFAChallenge).not.toHaveBeenCalled();
  });
});
