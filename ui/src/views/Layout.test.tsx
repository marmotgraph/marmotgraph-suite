import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Layout from "./Layout";
import { isEmbedded } from "../services/embedding";
import { useUnsavedInstances } from "../contexts/UnsavedInstancesContext";

vi.mock("../services/embedding", () => ({ isEmbedded: vi.fn() }));
vi.mock("../contexts/UnsavedInstancesContext", () => ({ useUnsavedInstances: vi.fn() }));
vi.mock("../components/SidebarMG", () => ({ default: () => <nav>general navigation</nav> }));
vi.mock("../components/composites/Footer", () => ({ default: () => null }));
vi.mock("../hooks/useAppSubNav", () => ({ useAppSubNav: () => undefined }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Layout>content</Layout>
    </MemoryRouter>,
  );

describe("Layout", () => {
  beforeEach(() => {
    vi.mocked(useUnsavedInstances).mockReturnValue({ drafts: [] } as never);
  });

  it("shows the general navigation and no link to jump out on its own", () => {
    vi.mocked(isEmbedded).mockReturnValue(false);
    renderAt("/editor");

    expect(screen.getByText("general navigation")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open in new tab" })).not.toBeInTheDocument();
  });

  it("replaces the general navigation with a link to the current page in a new tab when embedded", () => {
    vi.mocked(isEmbedded).mockReturnValue(true);
    renderAt("/editor/instances/1?edit=1");

    expect(screen.queryByText("general navigation")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open in new tab" });
    expect(link).toHaveAttribute("href", "/editor/instances/1?edit=1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("tells that unsaved changes don't move to the new tab", () => {
    vi.mocked(isEmbedded).mockReturnValue(true);
    vi.mocked(useUnsavedInstances).mockReturnValue({ drafts: [{}, {}] } as never);
    renderAt("/editor");

    expect(screen.getByText("2 unsaved instances stay here")).toBeInTheDocument();
  });
});
