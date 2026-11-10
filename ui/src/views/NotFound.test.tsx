import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import NotFound from "./NotFound";

describe("NotFound", () => {
  it("names the problem and leads back to the suite and the documentation", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the suite" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Open the documentation" })).toHaveAttribute("href", "/docs/");
  });
});
