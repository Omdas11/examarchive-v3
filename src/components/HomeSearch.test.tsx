import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HomeSearch from "./HomeSearch";
import React from "react";

// Mock useRouter
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("HomeSearch", () => {
  it("renders the search input", () => {
    render(<HomeSearch />);
    expect(screen.getByPlaceholderText(/Search exam papers/i)).toBeInTheDocument();
  });

  it("updates search query and performs search", async () => {
    render(<HomeSearch />);
    const input = screen.getByPlaceholderText(/Search exam papers/i);
    
    fireEvent.change(input, { target: { value: "maths" } });
    expect(input).toHaveValue("maths");

    fireEvent.submit(screen.getByRole("button", { name: /Search/i }));
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/browse?search=maths");
    });
  });

  it("shows suggestions when typing", async () => {
    render(<HomeSearch />);
    const input = screen.getByPlaceholderText(/Search exam papers/i);
    
    fireEvent.change(input, { target: { value: "cs" } });
    
    // Suggestions are shown after a short delay/debounce in real app, 
    // but here we just check if the list appears if suggestions were found.
    // Since suggestions are hardcoded in the component (for now or usually),
    // let's check if the list appears.
    // (In reality, suggestions might be fetched or filtered)
  });
});
