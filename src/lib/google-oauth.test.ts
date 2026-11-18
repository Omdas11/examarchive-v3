/**
 * @jest-environment node
 *
 * Node env (not jsdom): pkceChallenge uses crypto.subtle, which jsdom
 * does not provide. Workers and Node both have it.
 */
import {
  buildGoogleAuthUrl,
  decodeOAuthState,
  encodeOAuthState,
  pkceChallenge,
  safeRedirect,
} from "./google-oauth";

describe("safeRedirect", () => {
  it("defaults to / for null/empty input", () => {
    expect(safeRedirect(null)).toBe("/");
    expect(safeRedirect("")).toBe("/");
  });

  it("passes through same-site paths", () => {
    expect(safeRedirect("/profile")).toBe("/profile");
    expect(safeRedirect("/paper/abc?x=1")).toBe("/paper/abc?x=1");
  });

  it("rejects protocol-relative and absolute URLs (open-redirect guard)", () => {
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect("javascript:alert(1)")).toBe("/");
  });
});

describe("OAuth state cookie round-trip", () => {
  it("encodes and decodes the payload", () => {
    const payload = {
      state: "state-123",
      verifier: "verifier-abc",
      redirect: "/profile",
    };
    const encoded = encodeOAuthState(payload);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    expect(decodeOAuthState(encoded)).toEqual(payload);
  });

  it("returns null for garbage", () => {
    expect(decodeOAuthState("not-json")).toBeNull();
    expect(decodeOAuthState("")).toBeNull();
    expect(decodeOAuthState("%%%")).toBeNull();
  });
});

describe("pkceChallenge", () => {
  it("is a deterministic S256 base64url challenge", async () => {
    const challenge = await pkceChallenge("test-verifier");
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await pkceChallenge("test-verifier")).toBe(challenge);
    expect(await pkceChallenge("other-verifier")).not.toBe(challenge);
  });
});

describe("buildGoogleAuthUrl", () => {
  it("includes the client, redirect, state, and S256 challenge", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "client-123",
        redirectUri: "https://examarchive.dev/api/auth/callback/google",
        state: "state-123",
        codeChallenge: "challenge-abc",
      }),
    );
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://examarchive.dev/api/auth/callback/google",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});
