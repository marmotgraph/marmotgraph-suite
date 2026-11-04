import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import InstanceTransferList from "./InstanceTransferList";
import { LinkedInstance } from "../modules/editor/editorMockData";

const instances: LinkedInstance[] = ["A", "B", "C", "D", "E"].map((name) => ({
  instanceId: `id-${name}`,
  instanceName: `Instance ${name}`,
  type: "Building",
  space: "common",
}));

function checkbox(name: string) {
  return screen.getByRole("checkbox", {
    name: new RegExp(`Instance ${name}`),
  }) as HTMLInputElement;
}

/** Clicks the name of the instance (its label) - as users usually do */
function click(name: string, shiftKey = false) {
  const label = screen.getByText(`Instance ${name}`);
  fireEvent.mouseDown(label, { shiftKey });
  fireEvent.click(label, { shiftKey });
}

function renderList() {
  render(
    <InstanceTransferList
      instances={instances}
      availableInstances={instances}
      selectedIds={[]}
      onSelectedIdsChange={() => {}}
    />,
  );
}

describe("InstanceTransferList", () => {
  it("highlights the range between the last clicked and the shift-clicked instance", () => {
    renderList();

    click("B");
    click("D", true);

    expect(["A", "B", "C", "D", "E"].map((name) => checkbox(name).checked)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("removes the highlight from the range if the shift-clicked instance is highlighted", () => {
    renderList();

    click("A");
    click("E", true);
    click("B");
    click("D", true);

    expect(["A", "B", "C", "D", "E"].map((name) => checkbox(name).checked)).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it("toggles the instance when its checkbox is clicked", () => {
    renderList();

    fireEvent.click(checkbox("C"));
    expect(checkbox("C").checked).toBe(true);

    fireEvent.click(checkbox("C"));
    expect(checkbox("C").checked).toBe(false);
  });

  it("toggles a single instance without the shift key", () => {
    renderList();

    click("B");
    click("D");

    expect(["A", "B", "C", "D", "E"].map((name) => checkbox(name).checked)).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
  });
});
