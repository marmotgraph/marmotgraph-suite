import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LinkedInstance } from "../modules/editor/editorMockData";
import LinkedInstancesField from "./LinkedInstancesField";

vi.mock("../contexts/UnsavedInstancesContext", () => ({
  useUnsavedInstances: () => ({ getDraft: () => undefined }),
}));
vi.mock("./LinkedInstancesEditModal", () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>edit modal</div> : null),
}));
vi.mock("./LinkedInstancesModal", () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>view modal</div> : null),
}));

function instances(count: number): LinkedInstance[] {
  return Array.from({ length: count }, (_, index) => ({
    instanceId: `id-${index}`,
    instanceName: `subject-${index}`,
    type: "Subject",
    space: "demo",
    fieldLabel: "Species",
  }));
}

function renderField(count: number, isEditMode = true) {
  return render(
    <LinkedInstancesField
      fieldLabel="Species"
      linkedInstances={instances(count)}
      onInstanceClick={() => undefined}
      isEditMode={isEditMode}
      onChange={() => undefined}
      variant={isEditMode ? "edit" : "view"}
    />,
  );
}

describe("linked instances field in the edit mode", () => {
  it("shows the first instances and opens the editor for all of them from the link", () => {
    renderField(50);

    expect(screen.getAllByText(/^subject-/)).toHaveLength(5);
    // The pill only tells how many are not shown - the link is the way to them
    const more = screen.getByText("+45 more");
    expect(more).toHaveAttribute("title", "Showing 5 of 50");
    expect(more).not.toHaveAttribute("role", "button");
    expect(more.closest("button")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);

    fireEvent.click(more);
    expect(screen.queryByText("edit modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage all 50" }));

    expect(screen.getByText("edit modal")).toBeInTheDocument();
  });

  it("doesn't open an instance from its tag", () => {
    const onInstanceClick = vi.fn();
    render(
      <LinkedInstancesField
        fieldLabel="Species"
        linkedInstances={instances(3)}
        onInstanceClick={onInstanceClick}
        isEditMode
        onChange={() => undefined}
        variant="edit"
      />,
    );

    const tag = screen.getByText("subject-0");
    expect(screen.queryByRole("button", { name: /subject-0/ })).not.toBeInTheDocument();
    fireEvent.click(tag);
    fireEvent.keyDown(tag.closest(".linked-instance-badge") as HTMLElement, { key: "Enter" });

    expect(onInstanceClick).not.toHaveBeenCalled();
  });

  it("shows no pill when everything is shown", () => {
    renderField(5);

    expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("calls the link Manage with the count when everything is shown", () => {
    renderField(5);

    expect(screen.getByRole("button", { name: "Manage (5)" })).toBeInTheDocument();
  });

  it("leaves the view mode as it was", () => {
    renderField(50, false);


    expect(screen.getByRole("button", { name: "See all (50)" })).toBeInTheDocument();
    // The tags still open their instance
    expect(screen.getByRole("button", { name: /subject-0/ })).toBeInTheDocument();
  });
});
