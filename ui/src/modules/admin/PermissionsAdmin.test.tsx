import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PermissionsAdmin from "./PermissionsAdmin";
import { fetchRoleDefinitions, fetchRoles, updateRoleDefinition } from "../../services/permissions";

const auth = vi.hoisted(() => ({ getAccessToken: () => Promise.resolve("token") }));

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../hooks/useManagedSpaces", () => ({ useManagedSpaces: () => ({ spaces: [{ identifier: "known" }, { identifier: "another" }] }) }));
vi.mock("../../services/permissions", async (original) => ({
  ...(await original<object>()),
  fetchRoles: vi.fn(),
  fetchRoleDefinitions: vi.fn(),
  updateRoleDefinition: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchRoles).mockResolvedValue(["consumer", "admin"]);
  vi.mocked(fetchRoleDefinitions).mockResolvedValue([
    { space: "withclaims", role: "admin", claims: { email: ["a@example.org", "b@example.org"] } },
    { space: "another", role: "consumer", claims: { roles: { group: ["readers"] } } },
  ]);
});

describe("PermissionsAdmin", () => {
  it("lists the global claims first and the spaces by name - managed ones even without claims", async () => {
    render(<PermissionsAdmin />);
    await screen.findByText("withclaims");
    const headers = [...document.querySelectorAll(".admin-space-header span")].map((e) => e.textContent);
    expect(headers).toEqual(["Global", "another", "known", "withclaims"]);
    const global = screen.getByText("Global").closest("section") as HTMLElement;
    expect(within(global).getByText("No global claims are defined.")).toBeInTheDocument();
    const known = screen.getByText("known").closest("section") as HTMLElement;
    expect(within(known).getByText("No claims are defined for this space.")).toBeInTheDocument();
    expect(screen.getByText("4 groups")).toBeInTheDocument();
    // Claims are added per space - not per role
    expect(screen.queryByRole("button", { name: /Add claim to/ })).not.toBeInTheDocument();
  });

  it("splits the claims of a role so they can be removed one by one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(updateRoleDefinition).mockResolvedValue({ space: "withclaims", role: "admin", claims: { email: ["b@example.org"] } });
    render(<PermissionsAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: 'Remove the claim {"email":["a@example.org"]} from admin' }));
    await waitFor(() =>
      expect(updateRoleDefinition).toHaveBeenCalledWith("token", "admin", "withclaims", { email: ["a@example.org"] }, true),
    );
    await waitFor(() => expect(screen.queryByText('{"email":["a@example.org"]}')).not.toBeInTheDocument());
    expect(screen.getByText('{"email":["b@example.org"]}')).toBeInTheDocument();
  });

  it("filters by space and claim", async () => {
    render(<PermissionsAdmin />);
    await screen.findByText("withclaims");
    fireEvent.change(screen.getByLabelText("Filter by space or claim"), { target: { value: "readers" } });
    expect(screen.queryByText("withclaims")).not.toBeInTheDocument();
    expect(screen.getByText("another")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by space or claim"), { target: { value: "nothing" } });
    expect(screen.getByText("No permissions match the filter.")).toBeInTheDocument();
  });

  it("adds a claim to the space of the card", async () => {
    vi.mocked(updateRoleDefinition).mockResolvedValue({ space: "another", role: "admin", claims: { roles: { group: ["x"] } } });
    render(<PermissionsAdmin />);
    await screen.findByText("another");
    fireEvent.click(screen.getByRole("button", { name: "Add claim (another)" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Space")).toHaveValue("another");
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "admin" } });
    fireEvent.change(within(dialog).getByLabelText("Claim (JSON)"), { target: { value: '{"roles": {"group": ["x"]}}' } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(updateRoleDefinition).toHaveBeenCalledWith("token", "admin", "another", { roles: { group: ["x"] } }, false),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("rejects claims which are no JSON object", async () => {
    render(<PermissionsAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Add claim (Global)" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Space")).toHaveValue("");
    fireEvent.change(within(dialog).getByLabelText("Claim (JSON)"), { target: { value: "[1]" } });
    expect(within(dialog).getByText("The claim has to be a JSON object")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("reports if the permissions can't be loaded", async () => {
    vi.mocked(fetchRoleDefinitions).mockRejectedValue(new Error("Failed to load the permissions"));
    render(<PermissionsAdmin />);
    expect(await screen.findByText("Failed to load the permissions")).toBeInTheDocument();
  });
});
