import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "./Sidebar";

jest.mock("next/navigation", () => ({
  usePathname: () => "/browse",
  useRouter: () => ({ push: jest.fn() }),
}));

const ITEMS = [
  { label: "Browse", icon: "search", href: "/browse" },
  {
    label: "MD Verification",
    icon: "fact_check",
    href: "/admin/md-verification",
    tag: "New",
    badge: 3,
  },
];

describe("Sidebar collapsed-rail tooltip", () => {
  it("nav never scrolls sideways: it carries overflow-x-hidden", () => {
    const { container } = render(
      <Sidebar items={ITEMS} isCollapsed isLoggedIn userRole="founder" />
    );
    const nav = container.querySelector('nav[aria-label="Primary"]');
    expect(nav).not.toBeNull();
    expect(nav!.className).toContain("overflow-x-hidden");
  });

  it("no tooltip element lives inside the nav (the old in-link tooltip widened it)", () => {
    const { container } = render(
      <Sidebar items={ITEMS} isCollapsed isLoggedIn userRole="founder" />
    );
    const nav = container.querySelector('nav[aria-label="Primary"]')!;
    expect(nav.querySelector('[role="tooltip"]')).toBeNull();
    expect(nav.querySelector(".left-full")).toBeNull();
    expect(nav.querySelector(".absolute")).toBeNull();
  });

  it("hovering a collapsed item portals the tooltip to document.body, not the nav", () => {
    const { container } = render(
      <Sidebar items={ITEMS} isCollapsed isLoggedIn userRole="founder" />
    );
    const nav = container.querySelector('nav[aria-label="Primary"]')!;
    fireEvent.mouseEnter(screen.getByLabelText("MD Verification"));
    const tooltip = document.body.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toContain("MD Verification");
    expect(tooltip!.textContent).toContain("New");
    expect(tooltip!.textContent).toContain("(3)");
    expect(nav.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("tooltip hides on mouse leave", () => {
    render(
      <Sidebar items={ITEMS} isCollapsed isLoggedIn userRole="founder" />
    );
    const link = screen.getByLabelText("MD Verification");
    fireEvent.mouseEnter(link);
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull();
    fireEvent.mouseLeave(link);
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("expanded sidebar shows no tooltip on hover", () => {
    render(
      <Sidebar items={ITEMS} isCollapsed={false} isLoggedIn userRole="founder" />
    );
    fireEvent.mouseEnter(screen.getByText("MD Verification"));
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });
});
