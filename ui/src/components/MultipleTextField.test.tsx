import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import InstanceFieldControl from "./InstanceFieldControl";
import { InstanceField } from "../services/instances";

const FIELD: InstanceField = { identifier: "aliases", label: "Aliases", kind: "TEXTS", required: false, readOnly: false };

function EditedField({ initial, onChange }: { initial: unknown; onChange: (value: unknown) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <InstanceFieldControl
      field={FIELD}
      value={value}
      onChange={(changed) => {
        setValue(changed);
        onChange(changed);
      }}
      isEditMode
      onInstanceClick={vi.fn()}
    />
  );
}

function renderEdited(initial: unknown) {
  const onChange = vi.fn();
  render(<EditedField initial={initial} onChange={onChange} />);
  return { onChange, input: screen.getByRole("textbox", { name: "Add a value to Aliases" }) };
}

describe("MultipleTextField", () => {
  it("shows the values as tags when not editing", () => {
    render(<InstanceFieldControl field={FIELD} value={["First", "Second"]} onChange={vi.fn()} isEditMode={false} onInstanceClick={vi.fn()} />);

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("states that there is no value when not editing an empty field", () => {
    render(<InstanceFieldControl field={FIELD} value={[]} onChange={vi.fn()} isEditMode={false} onInstanceClick={vi.fn()} />);

    expect(screen.getByText("No value")).toBeInTheDocument();
  });

  it("is not editable if the field is read only", () => {
    render(<InstanceFieldControl field={{ ...FIELD, readOnly: true }} value={["First"]} onChange={vi.fn()} isEditMode onInstanceClick={vi.fn()} />);

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("adds a trimmed value on enter and clears the input", () => {
    const { onChange, input } = renderEdited(["First"]);

    fireEvent.change(input, { target: { value: "  Second " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenLastCalledWith(["First", "Second"]);
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("adds the typed value when leaving the input", () => {
    const { onChange, input } = renderEdited(null);

    fireEvent.change(input, { target: { value: "First" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(["First"]);
  });

  it("ignores blank and already existing values", () => {
    const { onChange, input } = renderEdited(["First"]);

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "First" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  it("removes a value and keeps the focus in the field", () => {
    const { onChange, input } = renderEdited(["First", "Second"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove First" }));

    expect(onChange).toHaveBeenLastCalledWith(["Second"]);
    expect(screen.queryByText("First")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("removes only one of repeated values", () => {
    const { onChange } = renderEdited(["Same", "Same"]);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove Same" })[1]);

    expect(onChange).toHaveBeenLastCalledWith(["Same"]);
  });

  it("shows a single stored value as one tag", () => {
    renderEdited("Single");

    expect(screen.getByRole("button", { name: "Remove Single" })).toBeInTheDocument();
  });
});
