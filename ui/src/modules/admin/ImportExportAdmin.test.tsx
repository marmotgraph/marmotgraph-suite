import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImportExportAdmin, { permittedSections } from "./ImportExportAdmin";
import { exportSettings, importSettings } from "../../services/settings";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";

const auth = vi.hoisted(() => ({ getAccessToken: () => Promise.resolve("token") }));
const reload = vi.hoisted(() => vi.fn());
const managedSpaces = vi.hoisted(() => ({ spaces: [{ identifier: "project" }] as { identifier: string }[] | undefined }));

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../contexts/ToolsContext", () => ({ useTools: () => ({ reload }) }));
vi.mock("../../hooks/useGlobalFunctionalities", () => ({ useGlobalFunctionalities: vi.fn() }));
vi.mock("../../hooks/useManagedSpaces", async (original) => ({
  ...(await original<object>()),
  useManagedSpaces: () => ({ spaces: managedSpaces.spaces, reload: vi.fn() }),
}));
vi.mock("../../services/settings", async (original) => ({
  ...(await original<object>()),
  exportSettings: vi.fn(),
  importSettings: vi.fn(),
}));

const FILE = {
  format: "marmotgraph-suite-settings",
  version: 1,
  spaces: [{ identifier: "project" }],
  permissions: [{ role: "admin", claims: {} }, { role: "owner", space: "project", claims: {} }],
  tenants: [{ name: "mytenant" }],
  tools: { categories: [{ name: "Search" }], definitions: [] },
};

function chooseFile(content: string) {
  const file = new File([content], "settings.json", { type: "application/json" });
  // jsdom doesn't implement reading files as text
  Object.defineProperty(file, "text", { value: () => Promise.resolve(content) });
  fireEvent.change(screen.getByLabelText("Settings file"), { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  managedSpaces.spaces = [{ identifier: "project" }];
  vi.mocked(useGlobalFunctionalities).mockReturnValue(["CREATE_PERMISSION", "DEFINE_TOOLS"]);
});

describe("permittedSections", () => {
  it("provides the sections the user may manage", () => {
    expect(permittedSections(["CREATE_PERMISSION", "TENANT_MANAGEMENT", "DEFINE_TOOLS"], true)).toEqual([
      "spaces",
      "permissions",
      "tenants",
      "tools",
    ]);
    expect(permittedSections(["DEFINE_TOOLS"], false)).toEqual(["tools"]);
    expect(permittedSections(undefined, false)).toEqual([]);
  });
});

describe("ImportExportAdmin", () => {
  it("waits for the permissions of the user", () => {
    vi.mocked(useGlobalFunctionalities).mockReturnValue(undefined);
    render(<ImportExportAdmin />);
    expect(screen.getByText(/Loading permissions/)).toBeInTheDocument();
  });

  it("exports the selected sections the user has the permissions for", async () => {
    vi.mocked(exportSettings).mockResolvedValue({ format: "marmotgraph-suite-settings", version: 1 });
    URL.createObjectURL = vi.fn(() => "blob:settings");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<ImportExportAdmin />);

    expect(screen.queryByLabelText("Tenants")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText("Permissions")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Export settings" }));

    await waitFor(() => expect(exportSettings).toHaveBeenCalledWith("token", ["spaces", "tools"]));
    await waitFor(() => expect(click).toHaveBeenCalled());
  });

  it("rejects files which are no settings export", async () => {
    render(<ImportExportAdmin />);
    chooseFile('{"foo": 1}');

    expect(await screen.findByText("The file is not a MarmotGraph settings export.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import settings" })).not.toBeInTheDocument();
  });

  it("imports the sections of the file the user has the permissions for and reports the outcome", async () => {
    vi.mocked(importSettings).mockResolvedValue([
      { section: "permissions", item: "admin (global)" },
      { section: "tools", item: "Category Search", error: "Forbidden (403)" },
    ]);
    render(<ImportExportAdmin />);
    chooseFile(JSON.stringify(FILE));

    // The tenants are part of the file but the user may not manage them
    const tenants = await screen.findByLabelText(/Tenants/);
    expect(tenants).toBeDisabled();
    expect(tenants).not.toBeChecked();
    expect(screen.getByLabelText(/Permissions 2/)).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Import settings" }));

    await waitFor(() => expect(importSettings).toHaveBeenCalledWith("token", FILE, ["spaces", "permissions", "tools"]));
    expect(await screen.findByText("1 imported, 1 failed")).toBeInTheDocument();
    expect(screen.getByText("Forbidden (403)")).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();
  });
});
