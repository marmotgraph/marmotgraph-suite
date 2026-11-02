import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import InstanceSingleSelectList from "./InstanceSingleSelectList";
import { LinkedInstance } from "../modules/editor/editorMockData";

const instances: LinkedInstance[] = ["A", "B"].map((name) => ({
  instanceId: `id-${name}`,
  instanceName: `Instance ${name}`,
  type: "Building",
  space: "common",
}));

function renderList(selected?: LinkedInstance) {
  const onSelect = vi.fn();
  render(
    <InstanceSingleSelectList
      instances={instances}
      selected={selected}
      onSelect={onSelect}
      emptyMessage="Nothing here"
    />,
  );
  return onSelect;
}

const radio = (name: string) => screen.getByRole<HTMLInputElement>("radio", { name: new RegExp(`Instance ${name}`) });

describe("InstanceSingleSelectList", () => {
  it("selects the clicked instance and has no multi-selection", () => {
    const onSelect = renderList(instances[0]);

    expect(radio("A").checked).toBe(true);
    expect(radio("B").checked).toBe(false);
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByText("Instance B"));

    expect(onSelect).toHaveBeenLastCalledWith("id-B");
  });

  it("lists a selected instance which isn't part of the instances and allows to clear it", () => {
    const onSelect = renderList({ instanceId: "id-Z", instanceName: "Instance Z", type: "Building", space: "other" });

    expect(radio("Z").checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("offers no clearing if nothing is selected", () => {
    renderList();

    expect(radio("A").checked).toBe(false);
    expect(radio("B").checked).toBe(false);
    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
  });

  it("filters by the search and shows the empty message", () => {
    renderList();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search instances" }), { target: { value: "nope" } });

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
