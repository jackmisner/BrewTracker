import { render, screen } from "@testing-library/react";
import About from "../../src/pages/About";

describe("About page", () => {
  it("renders its photos with real image URLs", () => {
    render(<About />);

    // Regression: images loaded via require() resolved to a module object
    // instead of a URL string after the move from CRA to Vite.
    const photos = screen.getAllByRole("img");
    expect(photos).toHaveLength(2);
    photos.forEach((photo) => {
      const src = photo.getAttribute("src") ?? "";
      expect(src).toMatch(/\.jpe?g$/);
      expect(src).not.toContain("[object");
    });
  });
});
