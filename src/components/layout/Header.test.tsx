import { render, screen } from "@testing-library/react";
import Header from "./Header";

describe("Header", () => {
  it("associates the desktop search input with an accessible label", () => {
    render(<Header showSearch={true} />);
    expect(
      screen.getByLabelText("Search papers and courses"),
    ).toBeInTheDocument();
  });
});
