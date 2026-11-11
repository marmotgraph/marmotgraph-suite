import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DocumentationHome from "./DocumentationHome";
import { useConfig } from "../../contexts/ConfigContext";

vi.mock("../../contexts/ConfigContext", () => ({ useConfig: vi.fn() }));

const card = (title: string) => screen.getByRole("listitem", { name: title });

describe("DocumentationHome", () => {
  beforeEach(() => {
    vi.mocked(useConfig).mockReturnValue({ coreUrl: "https://core.example.org" } as never);
  });

  it("opens the documentation of the suite in a new tab", () => {
    render(<DocumentationHome />);

    const link = within(card("Suite documentation")).getByRole("link", { name: /Open documentation/ });
    expect(link).toHaveAttribute("href", "/docs/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("opens the documentation of the core at the core", () => {
    vi.mocked(useConfig).mockReturnValue({ coreUrl: "https://core.example.org/" } as never);
    render(<DocumentationHome />);

    const link = within(card("Core documentation")).getByRole("link", { name: /Open documentation/ });
    expect(link).toHaveAttribute("href", "https://core.example.org/docs/");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows the documentation of the model as not available yet", () => {
    render(<DocumentationHome />);

    expect(within(card("Model documentation")).queryByRole("link")).not.toBeInTheDocument();
    expect(within(card("Model documentation")).getByText("Not available yet")).toBeInTheDocument();
  });
});
