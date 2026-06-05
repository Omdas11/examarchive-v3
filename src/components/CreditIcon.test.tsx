import { render } from "@testing-library/react";
import React from "react";
import CreditIcon from "./CreditIcon";

describe("CreditIcon", () => {
  it("renders with default size", () => {
    const { container } = render(<CreditIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
  });

  it("renders with custom size", () => {
    const { container } = render(<CreditIcon size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("renders with custom className", () => {
    const { container } = render(<CreditIcon className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
  });

  it("has aria-hidden by default", () => {
    const { container } = render(<CreditIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("can override aria-hidden", () => {
    const { container } = render(<CreditIcon aria-hidden="false" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "false");
  });

  it("contains the ₹ symbol", () => {
    const { getByText } = render(<CreditIcon />);
    expect(getByText("₹")).toBeInTheDocument();
  });
});
