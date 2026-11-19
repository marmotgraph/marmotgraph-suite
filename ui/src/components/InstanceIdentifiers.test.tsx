import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InstanceIdentifiers from "./InstanceIdentifiers";

const INSTANCE_ID = "8a9c5d1e-0f2b-4c3d-9e8f-1a2b3c4d5e6f";
const SAVED = ["https://example.org/devices/1", `https://example.org/instances/${INSTANCE_ID}`];

function renderIdentifiers(props: Partial<React.ComponentProps<typeof InstanceIdentifiers>> = {}) {
  const onRemove = vi.fn<(identifier: string) => Promise<void>>(() => Promise.resolve());
  render(
    <InstanceIdentifiers
      instanceId={INSTANCE_ID}
      identifiers={SAVED}
      saved={SAVED}
      isEditMode
      onChange={vi.fn()}
      onRemove={onRemove}
      {...props}
    />,
  );
  // Expanded by default only with unsaved identifiers
  const toggle = screen.queryByRole("button", { expanded: false });
  if (toggle) {
    fireEvent.click(toggle);
  }
  return onRemove;
}

describe("InstanceIdentifiers", () => {
  it("removes a stored identifier only after confirmation", async () => {
    const onRemove = renderIdentifiers();

    fireEvent.click(screen.getByRole("button", { name: "Remove identifier https://example.org/devices/1" }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText("Remove permanently?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove identifier https://example.org/devices/1" }));
    expect(onRemove).toHaveBeenCalledWith("https://example.org/devices/1");
    await waitFor(() => expect(screen.queryByText("Remove permanently?")).not.toBeInTheDocument());
  });

  it("keeps the identifier if the removal is cancelled", () => {
    const onRemove = renderIdentifiers();

    fireEvent.click(screen.getByRole("button", { name: "Remove identifier https://example.org/devices/1" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByText("Remove permanently?")).not.toBeInTheDocument();
  });

  it("shows why the removal failed", async () => {
    const onRemove = vi.fn(() => Promise.reject(new Error("The identifier is the target of a relation")));
    renderIdentifiers({ onRemove });

    fireEvent.click(screen.getByRole("button", { name: "Remove identifier https://example.org/devices/1" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove identifier https://example.org/devices/1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The identifier is the target of a relation");
    // Still to be confirmed - it can be tried again or cancelled
    expect(screen.getByText("Remove permanently?")).toBeInTheDocument();
  });

  it("doesn't offer to remove the identifier representing the id of the instance", () => {
    renderIdentifiers();

    expect(
      screen.queryByRole("button", { name: `Remove identifier https://example.org/instances/${INSTANCE_ID}` }),
    ).not.toBeInTheDocument();
  });

  it("doesn't offer to remove stored identifiers without the removal or outside of the edit mode", () => {
    renderIdentifiers({ onRemove: undefined });
    expect(screen.queryByRole("button", { name: /^Remove identifier/ })).not.toBeInTheDocument();
  });

  it("takes back an added identifier without asking", () => {
    const onChange = vi.fn();
    const onRemove = renderIdentifiers({ identifiers: [...SAVED, "device-2"], onChange });

    fireEvent.click(screen.getByRole("button", { name: "Remove the new identifier device-2" }));

    expect(onChange).toHaveBeenCalledWith(SAVED);
    expect(onRemove).not.toHaveBeenCalled();
  });
});
