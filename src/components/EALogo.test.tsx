import { render, screen, fireEvent } from "@testing-library/react";
import EALogo from "./EALogo";
import React from "react";

describe("EALogo", () => {
  it("renders the logo image by default", () => {
    render(<EALogo />);
    const img = screen.getByAltText("ExamArchive");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/branding/logo.png");
  });

  it("renders the SVG fallback if image fails to load", () => {
    render(<EALogo />);
    const img = screen.getByAltText("ExamArchive");
    fireEvent.error(img);

    // After error, it should show the SVG monogram (text "EA")
    expect(screen.getByLabelText("EA")).toBeInTheDocument();
  });

  it("applies the specified size", () => {
    render(<EALogo size={40} />);
    const img = screen.getByAltText("ExamArchive");
    expect(img).toHaveStyle({ width: "40px", height: "40px" });
  });
});
