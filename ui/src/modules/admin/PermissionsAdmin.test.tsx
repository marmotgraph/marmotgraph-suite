import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PermissionsAdmin from "./PermissionsAdmin";
import { spaceNameError } from "./SpaceModals";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import { fetchRoleDefinitions, fetchRoles } from "../../services/permissions";
import { deleteSpaceSpecification, fetchManagedSpaces, saveSpaceSpecification } from "../../services/spaces";

const auth = vi.hoisted(() => ({ getAccessToken: () => Promise.resolve("token") }));

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../hooks/useGlobalFunctionalities", () => ({ useGlobalFunctionalities: vi.fn() }));
vi.mock("../../services/permissions", async (original) => ({
  ...(await original<object>()),
  fetchRoles: vi.fn(),
  fetchRoleDefinitions: vi.fn(),
}));
vi.mock("../../services/spaces", () => ({
  fetchManagedSpaces: vi.fn(),
  saveSpaceSpecification: vi.fn(),
  deleteSpaceSpecification: vi.fn(),
}));

const ALL_OFF = { autoRelease: false, clientSpace: false, deferCache: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useGlobalFunctionalities).mockReturnValue(["MANAGE_SPACE"]);
  vi.mocked(fetchRoles).mockResolvedValue(["admin"]);
  vi.mocked(fetchRoleDefinitions).mockResolvedValue([{ space: "withclaims", role: "admin", claims: { email: "a@example.org" } }]);
  vi.mocked(fetchManagedSpaces).mockResolvedValue([
    { identifier: "managed", settings: { ...ALL_OFF, autoRelease: true }, specified: true },
    { identifier: "restricted", settings: null, specified: false },
    { identifier: "unspecified", settings: ALL_OFF, specified: false },
  ]);
  vi.mocked(saveSpaceSpecification).mockResolvedValue();
  vi.mocked(deleteSpaceSpecification).mockResolvedValue();
});

/** Waits for the spaces by their text - computing the roles of the whole page may take longer than findByRole waits. */
async function spaceButton(name: string) {
  await screen.findByText("restricted");
  return screen.getByRole("button", { name });
}

describe("PermissionsAdmin spaces", () => {
  it("lists the spaces without claims along with those with claims", async () => {
    render(<PermissionsAdmin />);
    const managed = (await screen.findByText("managed")).closest("section") as HTMLElement;
    expect(within(managed).getByText("Auto release")).toBeInTheDocument();
    expect(within(managed).queryByText("Client space")).not.toBeInTheDocument();
    expect(within(managed).getByText("No claims are defined for this space.")).toBeInTheDocument();
    expect(screen.getByText("withclaims")).toBeInTheDocument();
    expect(screen.getByText("5 spaces")).toBeInTheDocument();
  });

  it("disables the actions the user has no permissions for", async () => {
    vi.mocked(useGlobalFunctionalities).mockReturnValue([]);
    render(<PermissionsAdmin />);
    expect(await spaceButton("Edit space (restricted)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete specification (restricted)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit space (managed)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add space" })).toBeDisabled();
  });

  it("marks spaces without a specification and offers no deletion for them", async () => {
    render(<PermissionsAdmin />);
    const unspecified = (await screen.findByText("unspecified")).closest("section") as HTMLElement;
    expect(within(unspecified).getByText("Not specified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete specification (unspecified)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit space (unspecified)" })).toBeEnabled();
    const managed = screen.getByText("managed", { selector: "span" }).closest("section") as HTMLElement;
    expect(within(managed).queryByText("Not specified")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete specification (managed)" })).toBeEnabled();
    const restricted = screen.getByText("restricted").closest("section") as HTMLElement;
    expect(within(restricted).queryByText("Not specified")).not.toBeInTheDocument();
  });

  it("offers no specification actions for global roles or spaces the user can't see", async () => {
    render(<PermissionsAdmin />);
    await screen.findByText("withclaims");
    expect(screen.queryByRole("button", { name: "Edit space (withclaims)" })).not.toBeInTheDocument();
  });

  it("edits the specification of a space and reloads the spaces", async () => {
    render(<PermissionsAdmin />);
    fireEvent.click(await spaceButton("Edit space (managed)"));
    expect(screen.getByLabelText("Auto release")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Defer cache"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(saveSpaceSpecification).toHaveBeenCalledWith("token", "managed", { autoRelease: true, clientSpace: false, deferCache: true }),
    );
    await waitFor(() => expect(fetchManagedSpaces).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("adds a space - rejecting names which are taken", async () => {
    render(<PermissionsAdmin />);
    await screen.findByText("managed");
    fireEvent.click(screen.getByRole("button", { name: "Add space" }));
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "managed" } });
    expect(screen.getByText("A space with this name already exists")).toBeInTheDocument();
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: " newspace " } });
    fireEvent.click(add);
    await waitFor(() => expect(saveSpaceSpecification).toHaveBeenCalledWith("token", "newspace", ALL_OFF));
  });

  it("keeps the dialog open and shows the reason if saving fails", async () => {
    vi.mocked(saveSpaceSpecification).mockRejectedValue(new Error("Rejected by the core"));
    render(<PermissionsAdmin />);
    fireEvent.click(await spaceButton("Edit space (managed)"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Rejected by the core")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(fetchManagedSpaces).toHaveBeenCalledTimes(1);
  });

  it("deletes a specification only after the confirmation", async () => {
    render(<PermissionsAdmin />);
    fireEvent.click(await spaceButton("Delete specification (managed)"));
    expect(deleteSpaceSpecification).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete specification" }));
    await waitFor(() => expect(deleteSpaceSpecification).toHaveBeenCalledWith("token", "managed"));
    await waitFor(() => expect(fetchManagedSpaces).toHaveBeenCalledTimes(2));
  });

  it("offers adding global claims even if there are none yet", async () => {
    render(<PermissionsAdmin />);
    const global = (await screen.findByText("Global")).closest("section") as HTMLElement;
    expect(within(global).getByText("No global claims are defined.")).toBeInTheDocument();
    fireEvent.click(within(global).getByRole("button", { name: "Add claim (Global)" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Leave empty for a global role")).toHaveValue("");
  });

  it("keeps the permissions available if the spaces can't be loaded", async () => {
    vi.mocked(fetchManagedSpaces).mockRejectedValue(new Error("Failed to load the spaces"));
    render(<PermissionsAdmin />);
    expect(await screen.findByText("withclaims")).toBeInTheDocument();
    expect(await screen.findByText("Failed to load the spaces")).toBeInTheDocument();
  });
});

describe("spaceNameError", () => {
  it.each([
    ["", undefined],
    ["my.space-1_a", undefined],
    ["taken", "A space with this name already exists"],
    ["myspace", "This name is reserved"],
    ["review", "This name is reserved"],
    ["in valid", 'Space names may only contain letters, digits, ".", "-" and "_"'],
  ])("for %j", (name, expected) => {
    expect(spaceNameError(name, ["taken"])).toBe(expected);
  });
});
