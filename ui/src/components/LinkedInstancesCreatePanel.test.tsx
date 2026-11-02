import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LinkedInstancesCreatePanel from "./LinkedInstancesCreatePanel";
import { useQuerySpaces } from "../modules/query-builder/useQueryBuilderData";
import type { QuerySpace } from "../services/queries";

vi.mock("../modules/query-builder/useQueryBuilderData", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuerySpaces: vi.fn(),
}));

function space(identifier: string, canCreate: boolean, isPrivate = false): QuerySpace {
  // Editing doesn't imply creating - only the latter counts here
  return { identifier, isPrivate, canCreate, canWrite: true, canDelete: false };
}

const SPACES = [space("private-1", true, true), space("creatable", true), space("readonly", false)];

function renderPanel(defaultSpace = "") {
  const onCreate = vi.fn();
  render(<LinkedInstancesCreatePanel allowedTypes={["Device"]} defaultSpace={defaultSpace} onCreate={onCreate} />);
  return onCreate;
}

const spaceSelect = () => screen.getByRole<HTMLSelectElement>("combobox", { name: "Space for new instance", hidden: true });

describe("LinkedInstancesCreatePanel", () => {
  it("offers only the spaces the user can create instances in", () => {
    vi.mocked(useQuerySpaces).mockReturnValue({ data: SPACES });
    renderPanel();

    expect([...spaceSelect().options].map((option) => option.value)).toEqual(["private-1", "creatable"]);
    expect(spaceSelect().options[0].textContent).toBe("My private space");
  });

  it("starts with the space of the parent if the user can create instances in it", () => {
    vi.mocked(useQuerySpaces).mockReturnValue({ data: SPACES });
    renderPanel("creatable");

    expect(spaceSelect().value).toBe("creatable");
  });

  it("falls back to the private space if the user can't create instances in the space of the parent", () => {
    vi.mocked(useQuerySpaces).mockReturnValue({ data: SPACES });
    renderPanel("readonly");

    expect(spaceSelect().value).toBe("private-1");
  });

  it("creates the instances in the chosen space", () => {
    vi.mocked(useQuerySpaces).mockReturnValue({ data: SPACES });
    const onCreate = renderPanel();

    fireEvent.change(spaceSelect(), { target: { value: "creatable" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Blade-Rack-A1"), { target: { value: "Blade" } });
    fireEvent.click(screen.getByRole("button", { name: "Create & add", hidden: true }));

    expect(onCreate.mock.calls[0][0][0]).toMatchObject({ instanceName: "Blade", space: "creatable" });
  });

  it.each([
    ["while loading", {}, "Loading spaces..."],
    ["if loading failed", { error: "Failed" }, "Could not load the spaces"],
    ["if there is no space to create in", { data: [space("readonly", false)] }, "No spaces you can create in"],
  ])("can't create %s", (_, loaded, text) => {
    vi.mocked(useQuerySpaces).mockReturnValue(loaded);
    renderPanel();

    expect(spaceSelect()).toBeDisabled();
    expect(spaceSelect().options[0].textContent).toBe(text);
    fireEvent.change(screen.getByPlaceholderText("e.g. Blade-Rack-A1"), { target: { value: "Blade" } });
    expect(screen.getByRole("button", { name: "Create & add", hidden: true })).toBeDisabled();
  });
});
