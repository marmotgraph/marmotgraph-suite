import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import SpacesHome from "./SpacesHome";
import { spaceNameError } from "./SpaceModals";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import { spaceManagementAvailable } from "../../hooks/useManagedSpaces";
import {
  assignType,
  deleteSpaceSpecification,
  fetchManagedSpaces,
  fetchSpaceDetails,
  fetchSpaceTypes,
  saveSpaceSpecification,
} from "../../services/spaces";
import { fetchRoleDefinitions, fetchRoles } from "../../services/permissions";
import { SubNavActionsProvider, useRegisteredSubNavActions } from "../../contexts/SubNavActionsContext";

const auth = vi.hoisted(() => ({ getAccessToken: () => Promise.resolve("token") }));

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../hooks/useGlobalFunctionalities", () => ({ useGlobalFunctionalities: vi.fn() }));
vi.mock("../../services/spaces", () => ({
  fetchManagedSpaces: vi.fn(),
  fetchSpaceDetails: vi.fn(),
  fetchSpaceTypes: vi.fn(),
  assignType: vi.fn(),
  saveSpaceSpecification: vi.fn(),
  deleteSpaceSpecification: vi.fn(),
}));
vi.mock("../../services/permissions", async (original) => ({
  ...(await original<object>()),
  fetchRoles: vi.fn(),
  fetchRoleDefinitions: vi.fn(),
}));

const ALL_OFF = { autoRelease: false, clientSpace: false, deferCache: false };
const DEVICE = "https://example.org/types/Device";
const ROOM = "https://example.org/types/Room";

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

/** The page actions - rendered like the subnav does. */
function Actions() {
  return (
    <>
      {useRegisteredSubNavActions().map((action) => (
        <button key={action.label} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </>
  );
}

function renderAt(path: string) {
  render(
    <SubNavActionsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Actions />
        <Routes>
          <Route path="spaces/*" element={<SpacesHome />} />
        </Routes>
        <Location />
      </MemoryRouter>
    </SubNavActionsProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useGlobalFunctionalities).mockReturnValue([]);
  vi.mocked(fetchManagedSpaces).mockResolvedValue([{ identifier: "alpha", name: "Alpha project" }, { identifier: "beta" }]);
  vi.mocked(fetchSpaceDetails).mockImplementation((_token, space) =>
    Promise.resolve(
      space === "alpha"
        ? { identifier: "alpha", settings: { ...ALL_OFF, autoRelease: true, clientSpace: true }, specified: true }
        : { identifier: space, settings: ALL_OFF, specified: false },
    ),
  );
  vi.mocked(fetchSpaceTypes).mockResolvedValue([
    { identifier: DEVICE, name: "Device", color: "#ff0000", assigned: true, occurrences: 10 },
    { identifier: ROOM, name: "Room", assigned: false, occurrences: 1 },
  ]);
  vi.mocked(assignType).mockResolvedValue();
  vi.mocked(saveSpaceSpecification).mockResolvedValue();
  vi.mocked(deleteSpaceSpecification).mockResolvedValue();
  vi.mocked(fetchRoles).mockResolvedValue(["consumer", "admin"]);
  vi.mocked(fetchRoleDefinitions).mockResolvedValue([
    { space: "alpha", role: "admin", claims: { email: ["a@example.org"] } },
    { space: "beta", role: "admin", claims: { email: ["b@example.org"] } },
  ]);
});

describe("SpacesHome", () => {
  it("opens the first space the user manages", async () => {
    renderAt("/spaces");
    expect(await screen.findByRole("heading", { name: "Alpha project" })).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/spaces/alpha");
    expect(screen.getByRole("button", { name: "alpha" })).toHaveAttribute("aria-current", "true");
    expect(await screen.findByLabelText("Auto release")).toBeChecked();
  });

  it("switches between the spaces", async () => {
    renderAt("/spaces/alpha");
    fireEvent.click(await screen.findByRole("button", { name: "beta" }));
    expect(await screen.findByRole("heading", { name: "beta" })).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/spaces/beta");
    expect(await screen.findByText(/has no specification yet/)).toBeInTheDocument();
  });

  it("reports spaces the user doesn't manage", async () => {
    renderAt("/spaces/other");
    expect(await screen.findByText('You don\'t manage the space "other".')).toBeInTheDocument();
  });

  it("is not available without spaces to manage", async () => {
    vi.mocked(fetchManagedSpaces).mockResolvedValue([]);
    renderAt("/spaces");
    expect(await screen.findByText("You don't manage any spaces.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add space" })).not.toBeInTheDocument();
  });

  it("saves the settings of the space", async () => {
    renderAt("/spaces/alpha");
    const save = await screen.findByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    // The deprecated settings are not offered - but kept as they are
    expect(screen.queryByLabelText("Client space")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Defer cache")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Auto release"));
    fireEvent.click(save);
    await waitFor(() =>
      expect(saveSpaceSpecification).toHaveBeenCalledWith("token", "alpha", { autoRelease: false, clientSpace: true, deferCache: false }),
    );
  });

  it("deletes the specification only after the confirmation", async () => {
    renderAt("/spaces/alpha");
    fireEvent.click(await screen.findByRole("button", { name: "Delete specification" }));
    expect(deleteSpaceSpecification).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete specification" }));
    await waitFor(() => expect(deleteSpaceSpecification).toHaveBeenCalledWith("token", "alpha"));
    await waitFor(() => expect(fetchManagedSpaces).toHaveBeenCalledTimes(2));
  });

  it("offers no deletion for a space without specification", async () => {
    renderAt("/spaces/beta");
    expect(await screen.findByRole("button", { name: "Delete specification" })).toBeDisabled();
  });

  it("assigns types to the space and removes them", async () => {
    renderAt("/spaces/alpha");
    fireEvent.click(await screen.findByRole("tab", { name: "Types" }));
    expect(await screen.findByText("1 of 2 assigned")).toBeInTheDocument();
    expect(screen.getByText("10 instances")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Assign Room"));
    await waitFor(() => expect(assignType).toHaveBeenCalledWith("token", "alpha", ROOM, true));
    expect(await screen.findByText("2 of 2 assigned")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Assign Device"));
    await waitFor(() => expect(assignType).toHaveBeenCalledWith("token", "alpha", DEVICE, false));
  });

  it("filters the types", async () => {
    renderAt("/spaces/alpha");
    fireEvent.click(await screen.findByRole("tab", { name: "Types" }));
    fireEvent.change(await screen.findByLabelText("Filter types"), { target: { value: "roo" } });
    expect(screen.queryByText("Device")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter types"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "assigned" } });
    expect(screen.getByText("Device")).toBeInTheDocument();
    expect(screen.queryByText("Room")).not.toBeInTheDocument();
  });

  it("shows the permissions of the space only with the permissions to manage them", async () => {
    renderAt("/spaces/alpha");
    await screen.findByRole("tab", { name: "Types" });
    expect(screen.queryByRole("tab", { name: "Permissions" })).not.toBeInTheDocument();
    expect(fetchRoleDefinitions).not.toHaveBeenCalled();
  });

  it("shows the claims of the space with the permissions to manage them", async () => {
    vi.mocked(useGlobalFunctionalities).mockReturnValue(["CREATE_PERMISSION"]);
    renderAt("/spaces/alpha");
    fireEvent.click(await screen.findByRole("tab", { name: "Permissions" }));
    expect(await screen.findByText('{"email":["a@example.org"]}')).toBeInTheDocument();
    expect(screen.queryByText('{"email":["b@example.org"]}')).not.toBeInTheDocument();
    // The claims are managed in the admin module
    expect(screen.queryByRole("button", { name: /Remove the claim/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add claim/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "permissions" })).toHaveAttribute("href", "/admin/permissions");
  });

  it("adds a space with the global permission to manage spaces - rejecting names which are taken", async () => {
    vi.mocked(useGlobalFunctionalities).mockReturnValue(["MANAGE_SPACE"]);
    renderAt("/spaces/alpha");
    fireEvent.click(await screen.findByRole("button", { name: "Add space" }));
    const dialog = screen.getByRole("dialog");
    const add = within(dialog).getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "beta" } });
    expect(within(dialog).getByText("A space with this name already exists")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: " gamma " } });
    fireEvent.click(add);
    await waitFor(() => expect(saveSpaceSpecification).toHaveBeenCalledWith("token", "gamma", ALL_OFF));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/spaces/gamma"));
    expect(fetchManagedSpaces).toHaveBeenCalledTimes(2);
  });

  it("is available to create spaces even without spaces to manage", async () => {
    vi.mocked(useGlobalFunctionalities).mockReturnValue(["MANAGE_SPACE"]);
    vi.mocked(fetchManagedSpaces).mockResolvedValue([]);
    renderAt("/spaces");
    expect(await screen.findByText("You don't manage any spaces yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add space" })).toBeInTheDocument();
  });
});

describe("spaceManagementAvailable", () => {
  it("requires spaces to manage or the global permission to manage spaces", () => {
    expect(spaceManagementAvailable([{ identifier: "a" }], [])).toBe(true);
    expect(spaceManagementAvailable([], ["MANAGE_SPACE"])).toBe(true);
    expect(spaceManagementAvailable([], ["READ"])).toBe(false);
    expect(spaceManagementAvailable(undefined, undefined)).toBe(false);
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
