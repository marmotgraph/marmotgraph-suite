import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InstanceFieldControl from "./InstanceFieldControl";
import { EmbeddedInstance, InstanceField } from "../services/instances";
import { fetchTypeFields, fetchTypes } from "../services/types";

vi.mock("../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

vi.mock("../services/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/types")>()),
  fetchTypes: vi.fn(),
  fetchTypeFields: vi.fn(),
}));

const SLOT = "https://example.org/types/Slot";

function slot(position: number | null, serial: string | null = null): EmbeddedInstance {
  return {
    type: SLOT,
    typeLabel: "Slot",
    typeColor: "#ff9800",
    fields: [
      { identifier: "position", label: "Position", kind: "NUMBER", value: position, required: true, readOnly: false },
      { identifier: "serial", label: "Serial", kind: "TEXT", value: serial, required: false, readOnly: false },
    ],
  };
}

function nestedField(kind: "NESTED" | "SINGLE_NESTED"): InstanceField {
  return { identifier: "slots", label: "Slots", kind, required: false, readOnly: false, targetTypes: [SLOT] };
}

function renderField(field: InstanceField, value: unknown, isEditMode: boolean, onChange = vi.fn()) {
  render(
    <InstanceFieldControl
      field={field}
      value={value}
      onChange={onChange}
      isEditMode={isEditMode}
      onInstanceClick={vi.fn()}
    />,
  );
  return onChange;
}

describe("NestedInstancesField", () => {
  beforeEach(() => {
    vi.mocked(fetchTypes).mockReset().mockResolvedValue([{ identifier: SLOT, name: "Slot", color: "#ff9800" }]);
    vi.mocked(fetchTypeFields).mockReset();
  });

  it("shows each embedded instance as a subsection with its non-empty fields when not editing", () => {
    renderField(nestedField("NESTED"), [slot(1, "S-1"), slot(2)], false);

    const sections = screen.getAllByRole("region");
    expect(sections).toHaveLength(2);
    expect(sections[0]).toHaveTextContent("Position");
    expect(sections[0]).toHaveTextContent("S-1");
    expect(sections[1]).toHaveTextContent("2");
    expect(sections[1]).not.toHaveTextContent("Serial");
  });

  it("shows that there is no value when nothing is embedded", () => {
    renderField(nestedField("SINGLE_NESTED"), null, false);

    expect(screen.getByText("No value")).toBeInTheDocument();
  });

  it("changes the value of a field of an embedded instance", () => {
    const onChange = renderField(nestedField("NESTED"), [slot(1), slot(2)], true);

    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "5" } });

    expect(onChange).toHaveBeenCalledWith([slot(1), slot(5)]);
  });

  it("removes and reorders embedded instances", () => {
    const onChange = renderField(nestedField("NESTED"), [slot(1), slot(2)], true);

    fireEvent.click(screen.getByRole("button", { name: "Move down" }));
    expect(onChange).toHaveBeenLastCalledWith([slot(2), slot(1)]);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove Slot" })[0]);
    expect(onChange).toHaveBeenLastCalledWith([slot(2)]);
  });

  it("adds an instance with the empty fields of the chosen type", async () => {
    vi.mocked(fetchTypeFields).mockResolvedValue(slot(null).fields);
    const onChange = renderField(nestedField("SINGLE_NESTED"), null, true);

    fireEvent.click(screen.getByRole("button", { name: "Add Slot" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: SLOT, typeLabel: "Slot", fields: slot(null).fields }),
      ),
    );
    expect(fetchTypeFields).toHaveBeenCalledWith("token", SLOT);
  });

  it("allows only a single instance for a single nested field", () => {
    renderField(nestedField("SINGLE_NESTED"), slot(1), true);

    expect(screen.queryByRole("button", { name: /Add/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move down" })).not.toBeInTheDocument();
  });
});
