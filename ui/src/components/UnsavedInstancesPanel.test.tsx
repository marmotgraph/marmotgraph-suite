import React, { useEffect } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UnsavedInstancesPanel from "./UnsavedInstancesPanel";
import {
  UNSAVED_INSTANCES_STORAGE_KEY,
  UnsavedInstanceDraft,
  UnsavedInstancesProvider,
  useUnsavedInstances,
} from "../contexts/UnsavedInstancesContext";
import { createInstance, updateInstance } from "../services/instances";

const { addInstance } = vi.hoisted(() => ({ addInstance: vi.fn() }));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ getAccessToken: () => Promise.resolve("token") }),
}));

vi.mock("../contexts/InstancesContext", () => ({
  useInstances: () => ({ addInstance, instances: [] }),
}));

vi.mock("../services/instances", () => ({
  createInstance: vi.fn(),
  replaceRawInstance: vi.fn(),
  updateInstance: vi.fn(),
}));

const draft: UnsavedInstanceDraft = {
  instanceId: "inst-1",
  instanceName: "Headquarters",
  type: "Building",
  fieldValues: { name: "HQ" },
  baseline: { name: "Headquarters" },
  changedFieldLabels: ["Name"],
  updatedAt: 1,
};

function Seed({ item }: { item: UnsavedInstanceDraft }) {
  const { upsertDraft } = useUnsavedInstances();
  useEffect(() => {
    upsertDraft(item);
  }, [item, upsertDraft]);
  return null;
}

function renderPanel(currentInstanceId = "other", onSaveCurrent?: () => Promise<void>) {
  render(
    <MemoryRouter>
      <UnsavedInstancesProvider>
        <Seed item={draft} />
        <UnsavedInstancesPanel currentInstanceId={currentInstanceId} onSaveCurrent={onSaveCurrent} />
      </UnsavedInstancesProvider>
    </MemoryRouter>,
  );
}

async function openRail() {
  fireEvent.click(await screen.findByRole("button", { name: /Expand unsaved instances panel/ }));
}

describe("UnsavedInstancesPanel", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("saves a draft from its save button and drops it from the rail", async () => {
    vi.mocked(updateInstance).mockResolvedValue({
      instanceId: "inst-1",
      type: "Building",
      instanceName: "HQ",
      space: "default",
      permissions: "View, Edit",
      releaseStatus: "has changed",
    });
    renderPanel();

    await openRail();
    expect(screen.queryByRole("checkbox", { name: "Select all" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save all/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Headquarters" }));
    const dialog = await screen.findByRole("dialog", { name: "Save these changes?" });
    expect(dialog).toHaveTextContent("1 instance");
    expect(dialog).toHaveTextContent("1 change");
    expect(dialog).toHaveTextContent("Name");
    expect(dialog).toHaveTextContent("Headquarters → HQ");
    expect(updateInstance).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateInstance).toHaveBeenCalledWith("token", "inst-1", { name: "HQ" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save Headquarters" })).not.toBeInTheDocument(),
    );
    expect(addInstance).not.toHaveBeenCalled();
  });

  it("asks before discarding one unsaved instance", async () => {
    renderPanel();

    await openRail();
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes for Headquarters" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel unsaved changes?" });
    expect(dialog).toHaveTextContent("Headquarters");
    expect(dialog).toHaveTextContent("Name");
    expect(dialog).toHaveTextContent("Headquarters → HQ");
    expect(dialog).toHaveTextContent("The instances are not deleted.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("button", { name: "Save Headquarters" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel changes for Headquarters" }));
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Cancel unsaved changes?" })).getByRole(
        "button",
        { name: "Cancel changes" },
      ),
    );

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save Headquarters" })).not.toBeInTheDocument(),
    );
    expect(updateInstance).not.toHaveBeenCalled();
  });

  it("saves the open instance through the page and keeps a failed save on the item", async () => {
    const onSaveCurrent = vi.fn().mockRejectedValue(new Error("Failed to save the instance"));
    renderPanel("inst-1", onSaveCurrent);

    await openRail();
    fireEvent.click(screen.getByRole("button", { name: "Save Headquarters" }));
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Save these changes?" })).getByRole(
        "button",
        { name: "Save" },
      ),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to save the instance");
    expect(screen.getByRole("button", { name: "Save Headquarters" })).toBeInTheDocument();
    expect(updateInstance).not.toHaveBeenCalled();
  });

  it("restores drafts that were stored before this document loaded", async () => {
    sessionStorage.setItem(UNSAVED_INSTANCES_STORAGE_KEY, JSON.stringify({ "inst-1": draft }));
    render(
      <MemoryRouter>
        <UnsavedInstancesProvider>
          <UnsavedInstancesPanel />
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    await openRail();
    expect(screen.getByRole("button", { name: "Save Headquarters" })).toBeInTheDocument();
  });

  it("saves the checked drafts together and leaves the others", async () => {
    const warehouse: UnsavedInstanceDraft = {
      instanceId: "inst-2",
      instanceName: "Warehouse",
      type: "Building",
      fieldValues: { name: "WH" },
      baseline: { name: "Warehouse" },
      updatedAt: 2,
    };
    vi.mocked(updateInstance).mockResolvedValue({
      instanceId: "inst-1",
      type: "Building",
      instanceName: "HQ",
      space: "default",
      permissions: "View, Edit",
      releaseStatus: "has changed",
    });
    render(
      <MemoryRouter>
        <UnsavedInstancesProvider>
          <Seed item={draft} />
          <Seed item={warehouse} />
          <UnsavedInstancesPanel />
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    await openRail();
    expect(screen.queryByRole("button", { name: /^Save (all|selected)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cancel (all|selected)/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Headquarters" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Headquarters" }));
    expect(screen.getByRole("checkbox", { name: "Select all" })).toBePartiallyChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save selected (1)" }));
    const dialog = await screen.findByRole("dialog", { name: "Save selected changes?" });
    expect(dialog).toHaveTextContent("Headquarters → HQ");
    expect(dialog).not.toHaveTextContent("Warehouse → WH");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save selected" }));

    await waitFor(() =>
      expect(updateInstance).toHaveBeenCalledWith("token", "inst-1", { name: "HQ" }),
    );
    expect(updateInstance).not.toHaveBeenCalledWith("token", "inst-2", { name: "WH" });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save Headquarters" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Save Warehouse" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select all" })).not.toBeInTheDocument();
  });

  it("saves every draft from select all and keeps a failed one", async () => {
    const warehouse: UnsavedInstanceDraft = {
      instanceId: "inst-2",
      instanceName: "Warehouse",
      type: "Building",
      fieldValues: { name: "WH" },
      baseline: { name: "Warehouse" },
      changedFieldLabels: ["Name"],
      updatedAt: 2,
    };
    vi.mocked(updateInstance).mockImplementation(async (_token, instanceId) => {
      if (instanceId === "inst-2") {
        throw new Error("Failed to save Warehouse");
      }
      return {
        instanceId,
        type: "Building",
        instanceName: "HQ",
        space: "default",
        permissions: "View, Edit",
        releaseStatus: "has changed",
      };
    });
    render(
      <MemoryRouter>
        <UnsavedInstancesProvider>
          <Seed item={draft} />
          <Seed item={warehouse} />
          <UnsavedInstancesPanel />
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    await openRail();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Select Headquarters" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Warehouse" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Cancel all (2)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save all (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Save all changes?" });
    expect(dialog).toHaveTextContent("2 instances");
    expect(dialog).toHaveTextContent("2 changes");
    expect(dialog).toHaveTextContent("Headquarters → HQ");
    expect(dialog).toHaveTextContent("Warehouse → WH");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save all" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to save Warehouse");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save Headquarters" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Save Warehouse" })).toBeInTheDocument();
  });

  it("discards the checked drafts after confirmation and leaves the others", async () => {
    const warehouse: UnsavedInstanceDraft = {
      instanceId: "inst-2",
      instanceName: "Warehouse",
      type: "Building",
      fieldValues: { name: "WH" },
      baseline: { name: "Warehouse" },
      updatedAt: 2,
    };
    render(
      <MemoryRouter>
        <UnsavedInstancesProvider>
          <Seed item={draft} />
          <Seed item={warehouse} />
          <UnsavedInstancesPanel />
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    await openRail();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Headquarters" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel selected (1)" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel selected changes?" });
    expect(dialog).toHaveTextContent("The instances are not deleted.");
    expect(dialog).toHaveTextContent("Headquarters → HQ");
    expect(dialog).not.toHaveTextContent("Warehouse → WH");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("button", { name: "Save Headquarters" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel selected (1)" }));
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Cancel selected changes?" })).getByRole(
        "button",
        { name: "Cancel selected" },
      ),
    );

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save Headquarters" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Save Warehouse" })).toBeInTheDocument();
    expect(updateInstance).not.toHaveBeenCalled();
  });

  it("leaves out instances that are deselected in the confirmation", async () => {
    const warehouse: UnsavedInstanceDraft = {
      instanceId: "inst-2",
      instanceName: "Warehouse",
      type: "Building",
      fieldValues: { name: "WH" },
      baseline: { name: "Warehouse" },
      changedFieldLabels: ["Name"],
      updatedAt: 2,
    };
    vi.mocked(updateInstance).mockResolvedValue({
      instanceId: "inst-1",
      type: "Building",
      instanceName: "HQ",
      space: "default",
      permissions: "View, Edit",
      releaseStatus: "has changed",
    });
    render(
      <MemoryRouter>
        <UnsavedInstancesProvider>
          <Seed item={draft} />
          <Seed item={warehouse} />
          <UnsavedInstancesPanel />
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    await openRail();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Save all (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Save all changes?" });
    expect(within(dialog).getByRole("checkbox", { name: "Include Warehouse (Building)" })).toBeChecked();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Include Warehouse (Building)" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Include Headquarters (Building)" }));
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(dialog).toHaveTextContent("Choose at least one instance.");

    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Include Headquarters (Building)" }));
    expect(screen.getByRole("checkbox", { name: "Select Warehouse" })).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateInstance).toHaveBeenCalledWith("token", "inst-1", { name: "HQ" }),
    );
    expect(updateInstance).not.toHaveBeenCalledWith("token", "inst-2", expect.anything());
    expect(screen.getByRole("button", { name: "Save Warehouse" })).toBeInTheDocument();
  });

  it("warns when an included instance cannot be saved", async () => {
    const lobby: UnsavedInstanceDraft = {
      instanceId: "inst-new",
      instanceName: "Lobby",
      type: "Building",
      fieldValues: { name: "Lobby" },
      baseline: {},
      changedFieldLabels: ["Name"],
      isNew: true,
      updatedAt: 2,
    };
    render(
      <MemoryRouter>
        <UnsavedInstancesProvider>
          <Seed item={draft} />
          <Seed item={lobby} />
          <UnsavedInstancesPanel />
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    await openRail();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Save all (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Save all changes?" });
    expect(dialog).toHaveTextContent("2 instances");
    expect(dialog).toHaveTextContent("Lobby: Open this instance to save it. Its type is missing.");
    expect(within(dialog).getByRole("button", { name: "Save all" })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Include Lobby (Building)" }));
    expect(dialog).toHaveTextContent("1 of 2 instances");
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows the link status of each draft", async () => {
    const parent: UnsavedInstanceDraft = {
      instanceId: "range-1",
      instanceName: "test-002",
      type: "Mountain range",
      fieldValues: {
        countries: [{ instanceId: "country-1", instanceName: "test-001", type: "Country", space: "demo" }],
      },
      baseline: { countries: [] },
      changedFieldLabels: ["Countries"],
      updatedAt: 1,
    };
    const country: UnsavedInstanceDraft = {
      instanceId: "country-1",
      instanceName: "test-001",
      type: "Country",
      isNew: true,
      fieldValues: {},
      updatedAt: 2,
    };
    const stored: UnsavedInstanceDraft = {
      instanceId: "inst-3",
      instanceName: "Warehouse",
      type: "Building",
      fieldValues: { name: "WH" },
      baseline: { name: "Warehouse" },
      hasReverseLinks: true,
      updatedAt: 3,
    };
    render(
      <MemoryRouter>
        <UnsavedInstancesProvider>
          <Seed item={parent} />
          <Seed item={country} />
          <Seed item={stored} />
          <UnsavedInstancesPanel />
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    await openRail();
    expect(screen.getByRole("img", { name: "Outgoing links" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Incoming links" })).toHaveLength(2);
  });

  it("offers linked unsaved drafts and creates them before the instance that links to them", async () => {
    const countryType = "https://example.org/types/Country";
    const parent: UnsavedInstanceDraft = {
      instanceId: "range-1",
      instanceName: "test-002",
      type: "Mountain range",
      fieldValues: {
        countries: [{ instanceId: "country-1", instanceName: "test-001", type: "Country", space: "demo" }],
      },
      baseline: { countries: [] },
      changedFieldLabels: ["Countries"],
      updatedAt: 1,
    };
    const country: UnsavedInstanceDraft = {
      instanceId: "country-1",
      instanceName: "test-001",
      type: "Country",
      typeIdentifier: countryType,
      space: "demo",
      isNew: true,
      fieldValues: { name: "test-001" },
      changedFieldLabels: ["Name"],
      updatedAt: 2,
    };
    const order: string[] = [];
    vi.mocked(createInstance).mockImplementation(async () => {
      order.push("create");
      return {
        instanceId: "country-1",
        type: "Country",
        instanceName: "test-001",
        space: "demo",
        permissions: "View, Edit",
        releaseStatus: "in progress",
      };
    });
    vi.mocked(updateInstance).mockImplementation(async () => {
      order.push("update");
      return {
        instanceId: "range-1",
        type: "Mountain range",
        instanceName: "test-002",
        space: "demo",
        permissions: "View, Edit",
        releaseStatus: "has changed",
      };
    });
    render(
      <MemoryRouter>
        <UnsavedInstancesProvider>
          <Seed item={parent} />
          <Seed item={country} />
          <UnsavedInstancesPanel />
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    await openRail();
    fireEvent.click(screen.getByRole("button", { name: "Save test-002" }));
    const dialog = await screen.findByRole("dialog", { name: "Save these changes?" });
    expect(dialog).toHaveTextContent("1 linked instance is still unsaved and not part of this save.");
    expect(dialog).toHaveTextContent("test-001 has not been stored, so this link points at a draft.");
    expect(dialog).toHaveTextContent("Linked from test-002");
    expect(within(dialog).getByRole("checkbox", { name: "Include test-001 (Country)" })).not.toBeChecked();
    expect(createInstance).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Include linked drafts" }));
    expect(within(dialog).getByRole("checkbox", { name: "Include test-001 (Country)" })).toBeChecked();
    expect(dialog).toHaveTextContent("Included linked drafts are saved first");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(order).toEqual(["create", "update"]));
    expect(createInstance).toHaveBeenCalledWith(
      "token",
      "country-1",
      countryType,
      { name: "test-001" },
      "demo",
    );
  });
});
