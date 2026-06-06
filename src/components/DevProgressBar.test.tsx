import { render, screen, fireEvent } from "@testing-library/react";
import DevProgressBar from "./DevProgressBar";
import React from "react";

describe("DevProgressBar", () => {
  it("renders with the provided progress", () => {
    render(<DevProgressBar progress={60} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "60");
  });

  it("toggles the detail view when clicked", () => {
    render(<DevProgressBar progress={40} />);
    // In test env, it often defaults to open because of useEffect + cookie logic
    // We want the toggle button, not the dismiss button
    const button = screen.getByLabelText(/^(Show|Hide) development notice$/i);
    
    const isInitiallyOpen = button.getAttribute("aria-expanded") === "true";

    fireEvent.click(button);

    // After click: should be the opposite state
    expect(button).toHaveAttribute("aria-expanded", isInitiallyOpen ? "false" : "true");
  });

  it("clamps progress between 0 and 100", () => {
    render(<DevProgressBar progress={150} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    
    render(<DevProgressBar progress={-20} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
