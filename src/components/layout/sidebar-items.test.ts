import { APP_SIDEBAR_ITEMS, isSidebarItemVisible } from "./appSidebarItems";

describe("sidebar MD Verification entry", () => {
  const mdItem = APP_SIDEBAR_ITEMS.find(
    (item) => item.href === "/admin/md-verification",
  );

  it("exists in the Admin section with the verifier flag", () => {
    expect(mdItem).toBeDefined();
    expect(mdItem?.label).toBe("MD Verification");
    expect(mdItem?.roles).toEqual(["moderator", "founder"]);
    expect(mdItem?.showForMdVerifier).toBe(true);
  });

  it("shows to founder and moderator by role", () => {
    expect(isSidebarItemVisible(mdItem!, "founder", false)).toBe(true);
    expect(isSidebarItemVisible(mdItem!, "moderator", false)).toBe(true);
  });

  it("shows to an assigned verifier even as a student", () => {
    expect(isSidebarItemVisible(mdItem!, "student", true)).toBe(true);
  });

  it("hides from a plain student and from guests", () => {
    expect(isSidebarItemVisible(mdItem!, "student", false)).toBe(false);
    expect(isSidebarItemVisible(mdItem!, "user", false)).toBe(false);
  });

  it("does not leak other admin items to a student verifier", () => {
    const manageUsers = APP_SIDEBAR_ITEMS.find(
      (item) => item.href === "/admin/users",
    );
    expect(isSidebarItemVisible(manageUsers!, "student", true)).toBe(false);
  });

  it("shows public items to everyone", () => {
    const home = APP_SIDEBAR_ITEMS.find((item) => item.href === "/");
    expect(isSidebarItemVisible(home!, "student", false)).toBe(true);
    expect(isSidebarItemVisible(home!, "user", false)).toBe(true);
  });
});
