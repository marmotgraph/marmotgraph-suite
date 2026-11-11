import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToolsHome from "./ToolsHome";
import { useTools } from "../../contexts/ToolsContext";

vi.mock("../../contexts/ToolsContext", () => ({ useTools: vi.fn() }));

const SEARCH = {
  id: "search",
  name: "Search",
  icon: '<svg xmlns="http://www.w3.org/2000/svg"/>',
  tools: [
    {
      id: "t1",
      name: "Dataset search",
      description: "Full text search",
      category: { id: "search", name: "Search" },
      endpoint: "https://search.example.org",
    },
  ],
};

const renderAt = (categoryId: string) =>
  render(
    <MemoryRouter initialEntries={[`/tools/${categoryId}`]}>
      <Routes>
        <Route path="tools/:categoryId" element={<ToolsHome />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ToolsHome", () => {
  beforeEach(() => {
    vi.mocked(useTools).mockReturnValue({ categories: [SEARCH], reload: vi.fn() });
  });

  it("lists the tools of the category with a link opening them in a new tab", () => {
    renderAt("search");

    expect(screen.getByRole("heading", { level: 2, name: "Search" })).toBeInTheDocument();
    const card = screen.getByRole("listitem", { name: "Dataset search" });
    expect(within(card).getByText("Full text search")).toBeInTheDocument();
    const link = within(card).getByRole("link", { name: /Open tool/ });
    expect(link).toHaveAttribute("href", "https://search.example.org");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("shows the icon of the category as image", () => {
    const { container } = renderAt("search");

    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("tells if the category is unknown", () => {
    renderAt("unknown");

    expect(screen.getByText(/doesn't exist or has no tools/)).toBeInTheDocument();
  });

  it("shows the loading state until the tools are available", () => {
    vi.mocked(useTools).mockReturnValue({ reload: vi.fn() });
    renderAt("search");

    expect(screen.getByText("Loading tools...")).toBeInTheDocument();
  });
});
