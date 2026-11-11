import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SuiteHome from "./SuiteHome";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import { useConfig } from "../../contexts/ConfigContext";
import { DEFINE_TYPES } from "../../services/modeler";

vi.mock("../../contexts/ConfigContext", () => ({ useConfig: vi.fn() }));
vi.mock("../../hooks/useGlobalFunctionalities", () => ({ useGlobalFunctionalities: vi.fn() }));

const renderHome = () =>
  render(
    <MemoryRouter>
      <SuiteHome />
    </MemoryRouter>,
  );

const moduleNames = () => within(screen.getByRole("navigation", { name: "Modules" })).getAllByRole("link").map((l) => l.textContent);

describe("SuiteHome", () => {
  beforeEach(() => {
    vi.mocked(useGlobalFunctionalities).mockReturnValue([]);
    vi.mocked(useConfig).mockReturnValue({ tenant: "CSCS" } as never);
  });

  it("shows a title and a box linking to each module", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: "CSCS Knowledge Graph Suite" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Editor/ })).toHaveAttribute("href", "/editor");
    expect(screen.getByRole("link", { name: /^Query Builder/ })).toHaveAttribute("href", "/queries");
    expect(screen.getByRole("link", { name: /^Statistics/ })).toHaveAttribute("href", "/statistics");
    expect(screen.getByRole("link", { name: /^APIs/ })).toHaveAttribute("href", "/core-api");
  });

  it("falls back to the name of the suite without a tenant", () => {
    vi.mocked(useConfig).mockReturnValue({ tenant: "" } as never);
    renderHome();

    expect(screen.getByRole("heading", { name: "Knowledge Graph Suite" })).toBeInTheDocument();
  });

  it("points to the documentation in a new tab", () => {
    renderHome();

    const link = screen.getByRole("link", { name: /Open documentation/ });
    expect(link).toHaveAttribute("href", "https://docs.marmotgraph.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("only offers the modeler to users who may modify the model", () => {
    renderHome();
    expect(moduleNames().some((name) => name?.startsWith("Modeler"))).toBe(false);
  });

  it("offers the modeler to users who may define types", () => {
    vi.mocked(useGlobalFunctionalities).mockReturnValue([DEFINE_TYPES]);
    renderHome();
    expect(screen.getByRole("link", { name: /^Modeler/ })).toHaveAttribute("href", "/modeler");
  });
});
