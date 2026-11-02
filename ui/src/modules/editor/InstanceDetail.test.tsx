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
import { addComment, deleteComment, fetchComments, InstanceComment, updateComment } from "../../services/comments";
import { UnsavedInstanceDraft, UnsavedInstancesProvider, useUnsavedInstances } from "../../contexts/UnsavedInstancesContext";

vi.mock("../../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

const { deleteInstances } = vi.hoisted(() => ({ deleteInstances: vi.fn() }));

vi.mock("../../contexts/InstancesContext", () => ({
  useInstances: () => ({ addInstance: vi.fn(), deleteInstances, instances: [] }),
}));

vi.mock("../../services/instances", () => ({
  IDENTIFIER: "http://schema.org/identifier",
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

vi.mock("../../services/comments", () => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  fetchComments: vi.fn(),
  updateComment: vi.fn(),
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
  describe("contributions to a field", () => {
    const nameField: InstanceField = {
      identifier: "https://example.org/name",
      label: "Name",
      kind: "TEXT",
      value: "Headquarters",
      required: false,
      readOnly: false,
    };
    const roomField: InstanceField = {
      identifier: "https://example.org/room",
      label: "Room",
      kind: "LINK",
      required: false,
      readOnly: false,
    };
    const jane = { username: "jane", name: "Jane Doe" };
    const joe = { username: "joe", name: "Joe Bloggs" };
    const unsavedBadge = (label: string) =>
      within(screen.getByText(label, { selector: "label" })).queryByText("Unsaved");

    it("shows on demand who has contributed which value", async () => {
      renderDetail("?edit=1", [nameField], "inst-1", {
        alternatives: {
          [nameField.identifier]: [
            { value: "Headquarters", selected: true, users: [jane, joe] },
            { value: "Main office", selected: false, users: [joe] },
          ],
        },
      });

      const toggle = await screen.findByRole("button", { name: "Contributions to Name (2 different values)" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Main office")).not.toBeInTheDocument();

      fireEvent.click(toggle);

      const panel = screen.getByRole("group", { name: "Contributions to Name" });
      const [current, other] = within(panel).getAllByRole("listitem");
      expect(within(current).getByText("Headquarters")).toBeInTheDocument();
      expect(within(current).getByText("Current")).toBeInTheDocument();
      expect(within(current).getByText("Jane Doe, Joe Bloggs")).toBeInTheDocument();
      expect(within(other).getByText("Main office")).toBeInTheDocument();
      expect(within(other).queryByText("Current")).not.toBeInTheDocument();
      expect(within(other).getByText("Joe Bloggs")).toBeInTheDocument();

      fireEvent.click(toggle);
      expect(screen.queryByRole("group", { name: "Contributions to Name" })).not.toBeInTheDocument();
    });

    it("tells who has defined a value nobody disagrees with - without a count", async () => {
      renderDetail("?edit=1", [nameField], "inst-1", {
        alternatives: { [nameField.identifier]: [{ value: "Headquarters", selected: true, users: [jane] }] },
      });

      fireEvent.click(await screen.findByRole("button", { name: "Contributions to Name" }));

      expect(within(screen.getByRole("group", { name: "Contributions to Name" })).getByText("Jane Doe")).toBeInTheDocument();
    });

    it("offers nothing for fields without contributions", async () => {
      renderDetail("?edit=1", [nameField]);

      await screen.findAllByText("Headquarters");
      expect(screen.queryByRole("button", { name: /Contributions to/ })).not.toBeInTheDocument();
    });

    it("shows linked values as links and contributions which can't be shown as a link as they are", async () => {
      vi.mocked(fetchTypes).mockResolvedValue([]);
      renderDetail("?edit=1", [roomField], "inst-1", {
        alternatives: {
          [roomField.identifier]: [
            {
              value: { instanceId: "room-2", instanceName: "Room B", type: "Room", space: "default", linkStatus: "resolved" },
              selected: true,
              users: [jane],
            },
            { text: "{@id=room-3}", selected: false, users: [] },
          ],
        },
      });

      fireEvent.click(await screen.findByRole("button", { name: "Contributions to Room (2 different values)" }));

      const panel = screen.getByRole("group", { name: "Contributions to Room" });
      expect(within(panel).getByRole("button", { name: "Room B" })).toBeInTheDocument();
      expect(within(panel).getByText("{@id=room-3}")).toBeInTheDocument();
      expect(within(panel).getByText("Unknown contributor")).toBeInTheDocument();
    });

    it("tells when the latest contribution removed the value", async () => {
      renderDetail("?edit=1", [{ ...nameField, value: undefined }], "inst-1", {
        alternatives: { [nameField.identifier]: [{ value: "Main office", selected: false, users: [joe] }] },
      });

      fireEvent.click(await screen.findByRole("button", { name: "Contributions to Name" }));

      expect(screen.getByText("The latest contribution removed the value of this field.")).toBeInTheDocument();
    });

    it("copies a contributed value into the field - and back", async () => {
      renderDetail("?edit=1", [nameField], "inst-1", {
        alternatives: {
          [nameField.identifier]: [
            { value: "Headquarters", selected: true, users: [jane] },
            { value: "Main office", selected: false, users: [joe] },
          ],
        },
      });

      fireEvent.click(await screen.findByRole("button", { name: "Contributions to Name (2 different values)" }));
      const [current, other] = within(screen.getByRole("group", { name: "Contributions to Name" })).getAllByRole("listitem");
      expect(within(current).getByRole("button", { name: "In field" })).toBeDisabled();

      fireEvent.click(within(other).getByRole("button", { name: "Copy to field" }));

      expect(screen.getByDisplayValue("Main office")).toBeInTheDocument();
      expect(unsavedBadge("Name")).toBeInTheDocument();
      expect(within(other).getByRole("button", { name: "In field" })).toBeDisabled();

      fireEvent.click(within(current).getByRole("button", { name: "Copy to field" }));

      expect(screen.getByDisplayValue("Headquarters")).toBeInTheDocument();
      expect(unsavedBadge("Name")).not.toBeInTheDocument();
    });

    it("notices that a value typed into the field matches a contribution", async () => {
      renderDetail("?edit=1", [nameField], "inst-1", {
        alternatives: { [nameField.identifier]: [{ value: "Main office", selected: false, users: [joe] }] },
      });

      fireEvent.click(await screen.findByRole("button", { name: "Contributions to Name" }));
      fireEvent.change(screen.getByDisplayValue("Headquarters"), { target: { value: "Main office" } });

      expect(screen.getByRole("button", { name: "In field" })).toBeDisabled();
    });

    it("copies a contributed link into the field", async () => {
      vi.mocked(fetchTypes).mockResolvedValue([]);
      const roomA = { instanceId: "room-1", instanceName: "Room A", type: "Room", space: "default", linkStatus: "resolved" };
      const roomB = { instanceId: "room-2", instanceName: "Room B", type: "Room", space: "default", linkStatus: "resolved" };
      renderDetail("?edit=1", [{ ...roomField, value: roomA }], "inst-1", {
        alternatives: {
          [roomField.identifier]: [
            { value: roomA, selected: true, users: [jane] },
            { value: roomB, selected: false, users: [joe] },
          ],
        },
      });

      fireEvent.click(await screen.findByRole("button", { name: "Contributions to Room (2 different values)" }));
      const panel = screen.getByRole("group", { name: "Contributions to Room" });
      const [current, other] = within(panel).getAllByRole("listitem");
      fireEvent.click(within(other).getByRole("button", { name: "Copy to field" }));

      expect(within(other).getByRole("button", { name: "In field" })).toBeDisabled();
      expect(within(current).getByRole("button", { name: "Copy to field" })).toBeInTheDocument();
      expect(unsavedBadge("Room")).toBeInTheDocument();
    });

    it("doesn't offer to copy what can't be copied", async () => {
      vi.mocked(fetchTypes).mockResolvedValue([]);
      const alternatives = {
        [nameField.identifier]: [{ value: "Main office", selected: false, users: [joe] }],
        [roomField.identifier]: [
          { text: "{@id=room-3}", selected: false, users: [] },
          { selected: false, users: [joe] },
        ],
      };
      renderDetail("?edit=1", [{ ...nameField, readOnly: true }, roomField], "inst-1", { alternatives });

      fireEvent.click(await screen.findByRole("button", { name: "Contributions to Name" }));
      fireEvent.click(screen.getByRole("button", { name: "Contributions to Room (2 different values)" }));

      expect(within(screen.getByRole("group", { name: "Contributions to Room" })).getByText("{@id=room-3}")).toBeInTheDocument();
      expect(screen.getByText("Main office")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Copy to field" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "In field" })).not.toBeInTheDocument();
    });

    it("is part of the edit mode only - without being part of the form", async () => {
      const alternatives = {
        [nameField.identifier]: [
          { value: "Headquarters", selected: true, users: [jane] },
          { value: "Main office", selected: false, users: [joe] },
        ],
      };
      renderDetail("", [nameField], "inst-1", { alternatives });

      await screen.findAllByText("Headquarters");
      expect(screen.queryByRole("button", { name: /Contributions to/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      fireEvent.click(await screen.findByRole("button", { name: "Contributions to Name (2 different values)" }));

      const panel = screen.getByRole("group", { name: "Contributions to Name" });
      expect(within(panel).getByText("Main office")).toBeInTheDocument();
      expect(within(panel).queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("Headquarters")).toBeInTheDocument();
    });
  });

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
    expect(within(document.querySelector(".instance-form") as HTMLElement).getByRole("textbox")).toHaveValue("");
    // The identifiers can be added to a new instance as well - in the header, apart from the fields
    expect(
      within(document.querySelector(".instance-header") as HTMLElement).getByRole("textbox", { name: "New identifier" }),
    ).toHaveValue("");
    expect(fetchTypeFields).toHaveBeenCalledWith("token", device);
    expect(fetchInstance).not.toHaveBeenCalled();
    // Named "New instance" until the label field is filled in
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("New instance");
    expect(screen.queryByRole("button", { name: "Delete instance" })).not.toBeInTheDocument();

    fireEvent.change(within(document.querySelector(".instance-form") as HTMLElement).getByRole("textbox"), { target: { value: "SN-42" } });

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

    await screen.findByRole("button", { name: "Save" });
    fireEvent.change(within(document.querySelector(".instance-form") as HTMLElement).getByRole("textbox"), { target: { value: "SN-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(createInstance).toHaveBeenCalledWith("token", instanceId, device, {
        [serialNumber]: "SN-42",
      }, undefined),
    );
    // Shown as stored by the core - no longer in the edit mode
    expect(await screen.findByText("private-1234")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(updateInstance).not.toHaveBeenCalled();
  });

  describe("a draft of a new instance reopened from the unsaved instances", () => {
    const device = "https://example.org/types/Device";
    const serialNumber = "https://example.org/serialNumber";
    const instanceId = "7d3c5b52-4d4b-4d0e-9a3e-2f6f2b1c8e02";

    /** Lists the draft before the instance is opened - without the type in the URL */
    function WithDraft({ draft, children }: { draft: UnsavedInstanceDraft; children: React.ReactNode }) {
      const { drafts, getDraft, upsertDraft } = useUnsavedInstances();
      const [seeded, setSeeded] = React.useState(false);
      React.useEffect(() => {
        upsertDraft(draft);
        setSeeded(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <>
          <div data-testid="drafts">{drafts.length}</div>
          {seeded && getDraft(draft.instanceId) && children}
        </>
      );
    }

    function renderDraft(fieldValues: Record<string, unknown>, labelProperty?: string) {
      vi.mocked(fetchTypes).mockResolvedValue([{ identifier: device, name: "Device", labelProperty }]);
      vi.mocked(fetchTypeFields).mockResolvedValue([
        { identifier: serialNumber, label: "Serial number", kind: "TEXT", required: true, readOnly: false },
      ]);
      vi.mocked(createInstance).mockResolvedValue({
        instanceId,
        type: "Device",
        instanceName: "SN-1",
        space: "shared",
        permissions: "View, Edit",
        releaseStatus: "in progress",
        fields: [],
        directLinks: [],
      });
      render(
        <MemoryRouter initialEntries={[`/editor/instances/${instanceId}`]}>
          <UnsavedInstancesProvider>
            <WithDraft
              draft={{
                instanceId,
                instanceName: "SN-1",
                type: "Device",
                typeIdentifier: device,
                space: "shared",
                isNew: true,
                fieldValues,
                updatedAt: 1,
              }}
            >
              <Routes>
                <Route path="/editor/instances/:instanceId" element={<InstanceDetail />} />
              </Routes>
            </WithDraft>
          </UnsavedInstancesProvider>
        </MemoryRouter>,
      );
    }

    it("is created with its type and in its space", async () => {
      renderDraft({ [serialNumber]: "SN-1" }, serialNumber);

      expect(await screen.findByRole("heading", { name: "SN-1" })).toBeInTheDocument();
      expect(fetchTypeFields).toHaveBeenCalledWith("token", device);
      expect(screen.getByText("shared")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(createInstance).toHaveBeenCalledWith("token", instanceId, device, { [serialNumber]: "SN-1" }, "shared"),
      );
    });

    it("stays listed if nothing is filled in yet - and keeps its space when it is", async () => {
      vi.mocked(createInstance).mockClear();
      renderDraft({});

      const save = await screen.findByRole("button", { name: "Save" });
      expect(screen.getByTestId("drafts")).toHaveTextContent("1");
      fireEvent.change(within(document.querySelector(".instance-form") as HTMLElement).getByRole("textbox"), { target: { value: "SN-1" } });
      fireEvent.click(save);

      await waitFor(() =>
        expect(createInstance).toHaveBeenCalledWith("token", instanceId, device, { [serialNumber]: "SN-1" }, "shared"),
      );
    });
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

  describe("comments", () => {
    const NAME: InstanceField = { identifier: "http://schema.org/name", label: "Name", kind: "TEXT", value: "HQ", required: false, readOnly: false };
    const comment = (overrides: Partial<InstanceComment>): InstanceComment => ({
      id: "c1",
      text: "A comment",
      createdAt: "2026-11-02T10:00:00Z",
      own: false,
      ...overrides,
    });
    const render = (comments: InstanceComment[], permissions = "View, Comment", search = "") => {
      vi.mocked(fetchComments).mockResolvedValue(comments);
      renderDetail(search, [NAME], "inst-1", { permissions });
    };
    /** Opens the comments on the instance - or on its field */
    const open = async (subject: RegExp) => fireEvent.click(await screen.findByRole("button", { name: subject }));

    beforeEach(() => {
      vi.mocked(fetchComments).mockReset();
      vi.mocked(addComment).mockReset();
      vi.mocked(updateComment).mockReset();
      vi.mocked(deleteComment).mockReset();
    });

    it("are neither loaded nor reachable without the permission to comment", async () => {
      renderDetail("", [NAME], "inst-1", { permissions: "View" });

      await screen.findByRole("heading", { level: 2 });
      expect(screen.queryByRole("region", { name: /Comments on this instance/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Comments on/ })).not.toBeInTheDocument();
      expect(fetchComments).not.toHaveBeenCalled();
    });

    it("are no mode of their own", async () => {
      render([]);

      await screen.findByRole("button", { name: "Comments on this instance" });
      const modes = within(screen.getByRole("group", { name: "Mode" }));
      expect(modes.queryByRole("button", { name: /Comments/ })).not.toBeInTheDocument();
      expect(modes.getByRole("button", { name: "Read" })).toHaveAttribute("aria-pressed", "true");
    });

    it("tell their number at the field and are shown on request", async () => {
      render([comment({ text: "About the name", property: NAME.identifier, createdBy: { username: "jd", name: "Jane Doe" } })]);

      const toggle = await screen.findByRole("button", { name: "Comments on Name (1)" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("About the name")).not.toBeInTheDocument();

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("About the name")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();

      fireEvent.click(toggle);

      expect(screen.queryByText("About the name")).not.toBeInTheDocument();
    });

    it("on the instance and on properties without a field are listed at the instance", async () => {
      render([
        comment({ id: "c1", text: "About the instance" }),
        comment({ id: "c2", text: "About the name", property: NAME.identifier }),
        comment({ id: "c3", text: "About something else", property: "https://example.org/gone" }),
      ]);

      await open(/Comments on this instance \(2\)/);

      const overview = screen.getByRole("region", { name: /Comments on this instance/ });
      expect(document.querySelector(".instance-header-sections")).toContainElement(overview);
      expect(within(overview).getByText("About the instance")).toBeInTheDocument();
      expect(within(overview).getAllByText("A reviewer")).toHaveLength(2);
      expect(within(overview).getByText("gone")).toBeInTheDocument();
      expect(within(overview).getByText("About something else")).toBeInTheDocument();
      expect(screen.queryByText("About the name")).not.toBeInTheDocument();
    });

    it("can be added to a field - right away if it has none yet", async () => {
      render([]);
      vi.mocked(addComment).mockResolvedValue(comment({ text: "Typo?", property: NAME.identifier, own: true }));

      await open(/Comments on Name/);
      const submit = screen.getByRole("button", { name: "Add comment" });
      expect(submit).toBeDisabled();
      fireEvent.change(screen.getByRole("textbox", { name: "Comment on Name" }), { target: { value: " Typo? " } });
      fireEvent.click(submit);

      await waitFor(() => expect(screen.queryByRole("textbox", { name: "Comment on Name" })).not.toBeInTheDocument());
      expect(screen.getByText("Typo?")).toBeInTheDocument();
      expect(addComment).toHaveBeenCalledWith("token", "inst-1", NAME.identifier, "Typo?");
      expect(screen.getByRole("button", { name: "Comments on Name (1)" })).toBeInTheDocument();
    });

    it("are closed again if the first comment is canceled", async () => {
      render([]);

      await open(/Comments on Name/);
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("textbox", { name: "Comment on Name" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Comments on Name" })).toHaveAttribute("aria-expanded", "false");
    });

    it("on the instance only offer to add one once they are opened - and close again if it is canceled", async () => {
      render([]);

      const toggle = await screen.findByRole("button", { name: "Comments on this instance" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("textbox", { name: "Comment on this instance" })).not.toBeInTheDocument();

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(within(screen.getByRole("region", { name: /Comments on this instance/ })).getByRole("button", { name: "Cancel" }));

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await waitFor(() =>
        expect(screen.queryByRole("textbox", { name: "Comment on this instance" })).not.toBeInTheDocument(),
      );
    });

    it("can be added in the edit mode - without touching the unsaved changes", async () => {
      render([], "View, Edit, Comment", "?edit=1");
      vi.mocked(addComment).mockResolvedValue(comment({ text: "Typo?", property: NAME.identifier, own: true }));

      await screen.findByRole("button", { name: "Save" });
      const input = document.querySelector<HTMLInputElement>(".instance-form input.form-control");
      fireEvent.change(input!, { target: { value: "Changed" } });
      await open(/Comments on Name/);
      fireEvent.change(screen.getByRole("textbox", { name: "Comment on Name" }), { target: { value: "Typo?" } });
      fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

      await waitFor(() => expect(screen.getByRole("button", { name: "Comments on Name (1)" })).toBeInTheDocument());
      expect(input).toHaveValue("Changed");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(updateInstance).not.toHaveBeenCalled();
    });

    it("on the instance are available in the other modes as well", async () => {
      render([comment({ text: "About the instance" })]);

      await open(/^Raw|raw JSON/);
      expect(screen.getByRole("button", { name: /raw JSON/ })).toHaveAttribute("aria-pressed", "true");
      await open(/Comments on this instance \(1\)/);

      expect(screen.getByText("About the instance")).toBeInTheDocument();
    });

    it("keep the text if adding fails", async () => {
      render([]);
      vi.mocked(addComment).mockRejectedValue(new Error("Failed to add the comment"));

      await open(/Comments on this instance/);
      const input = screen.getByRole("textbox", { name: "Comment on this instance" });
      fireEvent.change(input, { target: { value: "Looks good" } });
      fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

      expect(await screen.findByText("Failed to add the comment")).toBeInTheDocument();
      expect(input).toHaveValue("Looks good");
    });

    it("can only be edited and deleted by their author", async () => {
      render([comment({ text: "Theirs" })]);

      await open(/Comments on this instance \(1\)/);

      expect(screen.getByText("Theirs")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Edit comment" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete comment" })).not.toBeInTheDocument();
    });

    it("of others can be deleted by those managing the space - but not edited", async () => {
      render([comment({ text: "Theirs" })], "View, Comment, Manage");

      await open(/Comments on this instance \(1\)/);

      expect(screen.getByRole("button", { name: "Delete comment" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Edit comment" })).not.toBeInTheDocument();
    });

    it("of the user can be edited", async () => {
      render([comment({ text: "Mine", own: true })]);
      vi.mocked(updateComment).mockResolvedValue(comment({ text: "Changed", own: true, updatedAt: "2026-11-02T11:00:00Z" }));

      await open(/Comments on this instance \(1\)/);
      fireEvent.click(screen.getByRole("button", { name: "Edit comment" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Edit comment" }), { target: { value: "Changed" } });
      fireEvent.click(screen.getByRole("button", { name: "Save comment" }));

      expect(await screen.findByText("(edited)")).toBeInTheDocument();
      expect(screen.getByText("Unsaved")).toBeInTheDocument();
      expect(updateComment).toHaveBeenCalledWith("token", "inst-1", "c1", "Changed");
    });

    it("are deleted after a confirmation", async () => {
      render([comment({ text: "Mine", own: true })]);
      vi.mocked(deleteComment).mockResolvedValue();

      await open(/Comments on this instance \(1\)/);
      fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
      expect(deleteComment).not.toHaveBeenCalled();
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete comment" }));

      await waitFor(() => expect(screen.queryByText("Mine")).not.toBeInTheDocument());
      expect(deleteComment).toHaveBeenCalledWith("token", "inst-1", "c1");
    });

    it("offer a retry if they can't be loaded", async () => {
      vi.mocked(fetchComments).mockRejectedValueOnce(new Error("Failed to load the comments"));
      render([comment({ text: "Loaded" })]);

      fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
      await open(/Comments on this instance \(1\)/);

      expect(screen.getByText("Loaded")).toBeInTheDocument();
    });
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

  it("shows the identifiers apart from the fields and marks the label field", async () => {
    renderDetail("", [
      { identifier: "name", label: "Name", kind: "TEXT", value: "Headquarters", required: false, readOnly: false, labelProperty: true },
      { identifier: "city", label: "City", kind: "TEXT", value: "Bern", required: false, readOnly: false },
    ], "inst-1", { identifiers: ["https://example.org/buildings/hq", "hq"] });

    const identifiers = await screen.findByRole("region", { name: /Identifiers/ });
    expect(document.querySelector(".instance-header")).toContainElement(identifiers);
    expect(document.querySelector(".instance-view")).not.toContainElement(identifiers);
    // Collapsed by default - the summary shows how many there are
    const toggle = within(identifiers).getByRole("button", { name: "Identifiers (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(identifiers.querySelector(".collapse")).not.toHaveClass("show");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(identifiers).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "https://example.org/buildings/hq",
      "hq",
    ]);
    expect(screen.getByText("Label").closest(".view-label")).toHaveTextContent("Name");
    // Nothing to add in the read mode
    expect(screen.queryByRole("textbox", { name: "New identifier" })).not.toBeInTheDocument();
  });

  it("hides the identifiers in the read mode if there are none", async () => {
    renderDetail("", [
      { identifier: "name", label: "Name", kind: "TEXT", value: "Headquarters", required: false, readOnly: false },
    ]);

    expect(await screen.findByText("Name")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Identifiers/ })).not.toBeInTheDocument();
  });

  it("has nothing to expand in the validation without errors", async () => {
    renderDetail(
      "",
      [{ identifier: "name", label: "Name", kind: "TEXT", value: "HQ", required: false, readOnly: false }],
      "inst-1",
      { validation: [{ name: "minimal", valid: true, compliance: 100, errors: [] }] },
    );

    const validation = await screen.findByRole("region", { name: "Validation" });
    expect(validation).toHaveTextContent("minimal");
    expect(within(validation).queryByRole("button")).not.toBeInTheDocument();
  });

  it("only adds identifiers - the stored ones can't be removed", async () => {
    vi.mocked(updateInstance).mockResolvedValue({
      instanceId: "inst-1",
      type: "Building",
      instanceName: "Headquarters",
      space: "default",
      permissions: "View, Edit",
      releaseStatus: "has changed",
      fields: [],
      identifiers: ["hq", "bern-hq"],
      directLinks: [],
    });
    renderDetail("?edit=1", [
      { identifier: "name", label: "Name", kind: "TEXT", value: "Headquarters", required: false, readOnly: false },
    ], "inst-1", { identifiers: ["hq"] });

    const identifiers = await screen.findByRole("region", { name: /Identifiers/ });
    fireEvent.click(within(identifiers).getByRole("button", { name: "Identifiers (1)" }));
    expect(within(identifiers).queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();

    const input = within(identifiers).getByRole("textbox", { name: "New identifier" });
    fireEvent.change(input, { target: { value: "hq" } });
    expect(within(identifiers).getByRole("button", { name: "Add identifier" })).toBeDisabled();
    expect(within(identifiers).getByText("The instance already has this identifier.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: " bern-hq " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("");
    // A new identifier can be taken back until it is saved
    expect(within(identifiers).getByRole("button", { name: "Remove the new identifier bern-hq" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Identifiers");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateInstance).toHaveBeenCalledWith("token", "inst-1", {
        "http://schema.org/identifier": ["hq", "bern-hq"],
      }),
    );
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

    const validation = await screen.findByRole("region", { name: "Validation" });
    const summary = validation.querySelector(".instance-header-section-summary") as HTMLElement;
    expect(summary).toHaveTextContent("minimal");
    expect(summary).toHaveTextContent("complete");
    expect(summary).toHaveTextContent("50%");

    // Collapsed by default - the summary tells the compliance and how many errors there are
    const toggle = within(validation).getByRole("button", { name: "Validation 2 errors" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(validation.querySelector(".collapse")).not.toHaveClass("show");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const errors = within(validation).getByRole("region", { name: "Validation errors" });
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
    expect(statusColumn).toHaveTextContent("released");
    expect(header).toContainElement(validation);

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
