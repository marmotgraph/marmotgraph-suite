import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstanceFilterPanel } from "./InstanceFilterPanel";

afterEach(cleanup);

const types = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `Type ${index}`,
    url: `https://example.org/types/Type${index}`,
    color: "#4caf50",
  }));

const noFilters = { types: [], spaces: [], permissions: [], releaseStatuses: [] };

function renderPanel(
  availableTypes = types(3),
  filters: typeof noFilters & { types: string[] } = noFilters,
  availableSpaces: string[] = ["private", "common"],
) {
  const onFiltersChange = vi.fn();
  render(
    <InstanceFilterPanel
      filters={filters}
      onFiltersChange={onFiltersChange}
      availableTypes={availableTypes}
      availableSpaces={availableSpaces}
    />,
  );
  return onFiltersChange;
}

const section = (title: string) =>
  screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("InstanceFilterPanel", () => {
  it("tells the number of options of each filter", () => {
    renderPanel(types(12));

    expect(section("Type")).toHaveTextContent("12");
    expect(section("Space")).toHaveTextContent("2");
    expect(section("Release status")).toHaveTextContent("3");
  });

  it("tells how many options of a filter are selected", () => {
    renderPanel(types(12), {
      ...noFilters,
      types: ["https://example.org/types/Type1", "https://example.org/types/Type2"],
    });

    expect(section("Type")).toHaveTextContent("2 of 12");
  });

  it("clears one filter without touching the others", () => {
    const onFiltersChange = renderPanel(types(3), {
      ...noFilters,
      types: ["https://example.org/types/Type1"],
      spaces: ["private"],
    } as typeof noFilters & { types: string[] });

    fireEvent.click(screen.getByRole("button", { name: "Clear Type" }));

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ types: [], spaces: ["private"] }));
    expect(screen.queryByRole("button", { name: "Clear Release status" })).not.toBeInTheDocument();
  });

  it("only offers a search for a long list", () => {
    renderPanel(types(3));
    expect(screen.queryByPlaceholderText("Filter types...")).not.toBeInTheDocument();
    cleanup();

    renderPanel(types(30));
    fireEvent.change(screen.getByPlaceholderText("Filter types..."), { target: { value: "type 2" } });

    // Type 2 and Type 20 to Type 29
    expect(section("Type")).toHaveTextContent("11 of 30");
    expect(within(section("Type")).getAllByRole("checkbox")).toHaveLength(11);
  });

  it("folds a filter away", () => {
    renderPanel(types(3));

    const toggle = screen.getByRole("button", { name: "Type" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/Type 0/)).toBeVisible();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText(/Type 0/)).not.toBeVisible();
    // the number of options is still told
    expect(section("Type")).toHaveTextContent("3");
  });
});
