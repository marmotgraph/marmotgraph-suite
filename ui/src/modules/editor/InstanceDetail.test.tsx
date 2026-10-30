import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InstanceDetail from "./InstanceDetail";
import {
  createInstance,
  deleteInstance,
  fetchIncomingLinks,
  fetchInstance,
  fetchRawInstance,
  fetchReleaseTree,
  IncomingLinks,
  InstanceDetail as InstanceDetailData,
  InstanceField,
  updateInstance,
} from "../../services/instances";
import { fetchTypeFields, fetchTypes } from "../../services/types";
import { UnsavedInstancesProvider } from "../../contexts/UnsavedInstancesContext";

vi.mock("../../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

const { deleteInstances } = vi.hoisted(() => ({ deleteInstances: vi.fn() }));

vi.mock("../../contexts/InstancesContext", () => ({
  useInstances: () => ({ addInstance: vi.fn(), deleteInstances, instances: [] }),
}));

vi.mock("../../services/instances", () => ({
  createInstance: vi.fn(),
  deleteInstance: vi.fn(),
  fetchInstance: vi.fn(),
  fetchIncomingLinks: vi.fn(),
  fetchRawInstance: vi.fn(),
  fetchReleaseTree: vi.fn(),
  releaseInstance: vi.fn(),
  unreleaseInstance: vi.fn(),
  appendIncomingLinks: vi.fn(),
  updateInstance: vi.fn(),
}));

vi.mock("../../services/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/types")>()),
  fetchTypes: vi.fn(),
  fetchTypeFields: vi.fn(),
}));

function renderDetail(
  search = "",
  fields: InstanceField[] = [],
  instanceId = "inst-1",
  details: Partial<InstanceDetailData> = {},
  incoming: IncomingLinks[] = [],
) {
  vi.mocked(fetchInstance).mockResolvedValue({
    instanceId: "inst-1",
    type: "Building",
    instanceName: "Headquarters",
    space: "default",
    permissions: "View, Edit",
    releaseStatus: "released",
    fields,
    directLinks: [],
    ...details,
  });
  vi.mocked(fetchIncomingLinks).mockResolvedValue(incoming);
  vi.mocked(fetchRawInstance).mockResolvedValue({});
  vi.mocked(fetchReleaseTree).mockResolvedValue({
    instanceId: "inst-1",
    instanceName: "Headquarters",
    type: "Building",
    releaseStatus: "released",
    canRelease: true,
    canUnrelease: true,
    children: [],
  });

  render(
    <MemoryRouter initialEntries={[`/editor/instances/${instanceId}${search}`]}>
      <UnsavedInstancesProvider>
        <Routes>
          <Route path="/editor" element={<div>Instance list</div>} />
          <Route
            path="/editor/instances/:instanceId"
            element={<InstanceDetail />}
          />
        </Routes>
      </UnsavedInstancesProvider>
    </MemoryRouter>,
  );
}

describe("InstanceDetail", () => {
  it("fills in a new instance with the empty fields of its type", async () => {
    const device = "https://example.org/types/Device";
    vi.mocked(fetchTypes).mockResolvedValue([
      {
        identifier: device,
        name: "Device",
        color: "#ff9800",
        labelProperty: "https://example.org/serialNumber",
      },
    ]);
    vi.mocked(fetchTypeFields).mockResolvedValue([
      {
        identifier: "https://example.org/serialNumber",
        label: "Serial number",
        kind: "TEXT",
        required: true,
        readOnly: false,
      },
    ]);

    const instanceId = "7d3c5b52-4d4b-4d0e-9a3e-2f6f2b1c8e01";
    renderDetail(`?new=1&type=${encodeURIComponent(device)}`, [], instanceId);

    expect(await screen.findByText(/Serial number/)).toBeInTheDocument();
    expect(screen.getByText("Device")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(fetchTypeFields).toHaveBeenCalledWith("token", device);
    expect(fetchInstance).not.toHaveBeenCalled();
    // Named "New instance" until the label field is filled in
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("New instance");
    expect(screen.queryByRole("button", { name: "Delete instance" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "SN-42" } });

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("SN-42");
  });

  it("creates a new instance with its id and the filled in fields when saving", async () => {
    const device = "https://example.org/types/Device";
    const serialNumber = "https://example.org/serialNumber";
    const instanceId = "7d3c5b52-4d4b-4d0e-9a3e-2f6f2b1c8e01";
    vi.mocked(fetchTypes).mockResolvedValue([
      { identifier: device, name: "Device", labelProperty: serialNumber },
    ]);
    vi.mocked(fetchTypeFields).mockResolvedValue([
      { identifier: serialNumber, label: "Serial number", kind: "TEXT", required: true, readOnly: false },
    ]);
    vi.mocked(createInstance).mockResolvedValue({
      instanceId,
      type: "Device",
      instanceName: "SN-42",
      space: "private-1234",
      permissions: "View, Edit",
      releaseStatus: "in progress",
      fields: [
        { identifier: serialNumber, label: "Serial number", kind: "TEXT", value: "SN-42", required: true, readOnly: false },
      ],
      directLinks: [],
    });
    renderDetail(`?new=1&type=${encodeURIComponent(device)}`, [], instanceId);

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "SN-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(createInstance).toHaveBeenCalledWith("token", instanceId, device, {
        [serialNumber]: "SN-42",
      }),
    );
    // Shown as stored by the core - no longer in the edit mode
    expect(await screen.findByText("private-1234")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(updateInstance).not.toHaveBeenCalled();
  });

  it("opens in view mode", async () => {
    renderDetail();

    expect(
      await screen.findByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("disables the modes the user may not use for the instance", async () => {
    renderDetail("?edit=1", [], "inst-1", { permissions: "View" });

    expect(await screen.findByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Release" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit" }).parentElement).toHaveAttribute(
      "title",
      "You don't have the permission to edit this instance",
    );
    expect(screen.getByRole("button", { name: "Read" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("does not open the release tree without the permission to release", async () => {
    renderDetail("?release=1");

    expect(await screen.findByRole("button", { name: "Release" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Read" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("list", { name: "Release tree" })).not.toBeInTheDocument();
  });

  it("opens in edit mode when requested from the preview", async () => {
    renderDetail("?edit=1");

    const save = await screen.findByRole("button", { name: "Save" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const remove = screen.getByRole("button", { name: "Delete instance" });
    expect(remove.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cancel.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(save).toBeDisabled();
    expect(cancel).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens in raw mode when requested from the preview", async () => {
    renderDetail("?raw=1");

    expect(
      await screen.findByRole("button", {
        name: "Show and edit the raw JSON",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("opens in release mode when requested", async () => {
    renderDetail("?release=1", [], "inst-1", { permissions: "View, Edit, Release" });

    expect(
      await screen.findByRole("button", { name: "Release" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByRole("list", { name: "Release tree" }),
    ).toBeInTheDocument();
  });

  it("switches to the release tree", async () => {
    renderDetail(undefined, [], "inst-1", { permissions: "View, Edit, Release" });

    fireEvent.click(await screen.findByRole("button", { name: "Release" }));

    expect(
      await screen.findByRole("list", { name: "Release tree" }),
    ).toBeInTheDocument();
    expect(fetchReleaseTree).toHaveBeenCalledWith("token", "inst-1");
  });

  it("saves only the changed fields", async () => {
    const field = (identifier: string, value: string): InstanceField => ({
      identifier,
      label: identifier,
      kind: "TEXT",
      value,
      required: false,
      readOnly: false,
    });
    vi.mocked(updateInstance).mockResolvedValue({
      instanceId: "inst-1",
      type: "Building",
      instanceName: "Renamed",
      space: "default",
      permissions: "View, Edit",
      releaseStatus: "has changed",
      fields: [field("name", "Renamed"), field("city", "Bern")],
      directLinks: [],
    });
    renderDetail("?edit=1", [field("name", "Headquarters"), field("city", "Bern")]);

    fireEvent.change(await screen.findByDisplayValue("Headquarters"), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateInstance).toHaveBeenCalledWith("token", "inst-1", {
        name: "Renamed",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Renamed" })).toBeInTheDocument();
  });

  it("shows the validation results and flags the fields with errors", async () => {
    const name = "https://example.org/name";
    const height = "https://example.org/height";
    renderDetail(
      "",
      [
        { identifier: name, label: "Name", kind: "TEXT", value: "HQ", required: true, readOnly: false },
        { identifier: height, label: "Height", kind: "TEXT", value: "tall", required: false, readOnly: false },
      ],
      "inst-1",
      {
        validation: [
          { name: "minimal", valid: true, compliance: 100, errors: [] },
          {
            name: "complete",
            valid: false,
            compliance: 50,
            errors: [
              { field: height, keyword: "type", message: "string found, integer expected" },
              { keyword: "additionalProperties", message: "property 'x' is not defined in the schema" },
            ],
          },
        ],
      },
    );

    const status = await screen.findByRole("region", { name: "Validation" });
    expect(status).toHaveTextContent("minimal");
    expect(status).toHaveTextContent("complete");
    expect(status).toHaveTextContent("50%");
    expect(status).not.toHaveTextContent("string found");

    const errors = screen.getByRole("region", { name: "Validation errors" });
    expect(errors).toHaveTextContent("2 errors");
    expect(errors).toHaveTextContent("Height");
    expect(errors).toHaveTextContent("string found, integer expected");
    expect(errors).toHaveTextContent("property 'x' is not defined in the schema");
    const header = document.querySelector(".instance-header") as HTMLElement;
    const titleColumn = header.querySelector(".instance-header-title-column") as HTMLElement;
    const statusColumn = header.querySelector(".instance-header-status") as HTMLElement;
    expect(header.querySelector(".instance-header-type-row")).toHaveTextContent("Building");
    expect(titleColumn.querySelector(".instance-name")).toHaveTextContent("Headquarters");
    expect(titleColumn).toHaveTextContent("ID:");
    expect(titleColumn).toHaveTextContent("Space:");
    expect(statusColumn.querySelector(".link-status-icon")).not.toBeNull();
    expect(statusColumn).toContainElement(status);
    expect(statusColumn).toHaveTextContent("released");
    expect(header).not.toContainElement(errors);

    // Only the field concerned by an error is flagged - with the error and its schema below it
    const heightSection = document.querySelector('[data-instance-field="Height"]') as HTMLElement;
    const nameSection = document.querySelector('[data-instance-field="Name"]') as HTMLElement;
    expect(heightSection.querySelector(".instance-field-validation-icon")).not.toBeNull();
    expect(heightSection).toHaveTextContent("string found, integer expected · complete");
    expect(nameSection.querySelector(".instance-field-required")).not.toBeNull();
    expect(heightSection.querySelector(".instance-field-required")).toBeNull();
    expect(nameSection.querySelector(".instance-field-validation-icon")).toBeNull();
    expect(nameSection.querySelector(".instance-field-validation-errors")).toBeNull();

    // The fields stay flagged while editing
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editedHeight = document.querySelector('[data-instance-field="Height"]') as HTMLElement;
    expect(editedHeight).toHaveTextContent("string found, integer expected · complete");
  });

  it("asks before deleting and warns when the instance is released or linked", async () => {
    renderDetail(
      "?edit=1",
      [],
      "inst-1",
      {
        directLinks: [
          { instanceId: "other", instanceName: "Blade", type: "Blade", space: "default" },
        ],
      },
      [
        {
          property: "https://example.org/partOf",
          label: "Part of",
          types: [
            {
              typeIdentifier: "https://example.org/types/Device",
              type: "Device",
              links: [{ instanceId: "rack", instanceName: "Rack", space: "default" }],
              total: 1,
            },
          ],
        },
      ],
    );

    fireEvent.click(await screen.findByRole("button", { name: "Delete instance" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete instance?" });
    expect(dialog).toHaveTextContent("You are about to permanently delete Headquarters.");
    expect(within(dialog).getByText("Building")).toBeInTheDocument();
    expect(within(dialog).getByText("inst-1")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      "Linked incoming and outgoing relationships will be removed with this instance.",
    );
    expect(dialog).toHaveTextContent(
      "This instance is released. Deleting it will also remove it from search.",
    );
    expect(dialog).toHaveTextContent("This action cannot be undone.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Delete instance?" })).not.toBeInTheDocument(),
    );
    expect(deleteInstance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete instance" }));
    vi.mocked(deleteInstance).mockResolvedValue(undefined);
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Delete instance?" })).getByRole("button", {
        name: "Delete instance",
      }),
    );

    await waitFor(() => expect(deleteInstance).toHaveBeenCalledWith("token", "inst-1"));
    expect(deleteInstances).toHaveBeenCalledWith(["inst-1"]);
    expect(await screen.findByText("Instance list")).toBeInTheDocument();
  });

  it("omits the delete warnings when the instance is unreleased and has no links", async () => {
    renderDetail("?edit=1", [], "inst-1", { releaseStatus: "in progress", directLinks: [] });

    fireEvent.click(await screen.findByRole("button", { name: "Delete instance" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete instance?" });
    expect(dialog).not.toHaveTextContent("relationships will be removed");
    expect(dialog).not.toHaveTextContent("remove it from search");
    expect(dialog).toHaveTextContent("This action cannot be undone.");
  });

  it("warns that a changed release is still removed from search", async () => {
    renderDetail("?edit=1", [], "inst-1", { releaseStatus: "has changed", directLinks: [] });

    fireEvent.click(await screen.findByRole("button", { name: "Delete instance" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete instance?" });
    expect(dialog).toHaveTextContent(
      "This instance is released. Deleting it will also remove it from search.",
    );
    expect(dialog).not.toHaveTextContent("relationships will be removed");
  });

  it("keeps the confirmation open when deletion fails", async () => {
    deleteInstances.mockClear();
    vi.mocked(deleteInstance).mockRejectedValue(new Error("Failed to delete the instance (403 Forbidden)"));
    renderDetail("?edit=1");

    fireEvent.click(await screen.findByRole("button", { name: "Delete instance" }));
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Delete instance?" })).getByRole("button", {
        name: "Delete instance",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("403 Forbidden");
    expect(screen.getByRole("dialog", { name: "Delete instance?" })).toBeInTheDocument();
    expect(deleteInstances).not.toHaveBeenCalled();
  });
});
