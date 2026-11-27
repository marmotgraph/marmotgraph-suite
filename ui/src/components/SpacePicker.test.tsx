import { fireEvent, render, screen } from "@testing-library/react";
import { QuerySpace } from "../services/queries";
import { SpacePicker, spacesToOffer, windowSpaces } from "./SpacePicker";

function space(identifier: string, canCreate = true, isPrivate = false, name?: string): QuerySpace {
  return { identifier, name, isPrivate, canCreate, canWrite: true, canDelete: false };
}

describe("spaces that can be chosen", () => {
  const spaces = [
    space("private-1", true, true),
    space("shared", true, false, "Shared project"),
    space("locked", false),
  ];

  it("offers the spaces the user can create in, and keeps the current one", () => {
    expect(spacesToOffer(spaces, "locked").map((item) => item.identifier)).toEqual([
      "private-1",
      "shared",
      "locked",
    ]);
    expect(spacesToOffer(spaces, "shared").map((item) => item.identifier)).toEqual(["private-1", "shared"]);
  });

  it("keeps a current space that the list does not know", () => {
    expect(spacesToOffer(spaces, "archive").map((item) => item.identifier)).toEqual([
      "archive",
      "private-1",
      "shared",
    ]);
  });

  it("mounts only a window of matches", () => {
    const many = Array.from({ length: 5000 }, (_, index) => space(`space-${String(index).padStart(4, "0")}`));
    const all = windowSpaces(many, "", "space-4999");
    expect(all.visible).toHaveLength(50);
    expect(all.total).toBe(5000);
    expect(all.visible[0].identifier).toBe("space-4999");

    const narrowed = windowSpaces(many, "4999", "space-0000");
    expect(narrowed.total).toBe(1);
    expect(narrowed.visible.map((item) => item.identifier)).toEqual(["space-4999"]);
  });
});

describe("SpacePicker", () => {
  const spaces = [
    space("private-1", true, true),
    space("shared", true, false, "Shared project"),
    ...Array.from({ length: 60 }, (_, index) => space(`room-${index}`)),
  ];

  it("filters the list and changes the space from the keyboard", () => {
    const onChange = vi.fn();
    render(<SpacePicker spaces={spaces} value="private-1" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Space:/ }));
    expect(screen.getByRole("searchbox", { name: "Search spaces" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBeLessThanOrEqual(50);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 50 of");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search spaces" }), { target: { value: "shared" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search spaces" }), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("shared");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not open while it is disabled", () => {
    render(
      <SpacePicker
        spaces={spaces}
        value="shared"
        onChange={vi.fn()}
        disabled
        disabledReason="Unrelease this instance before changing its space."
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Space:/ }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("Unrelease this instance before changing its space.")).toBeInTheDocument();
  });
});
