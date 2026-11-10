import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LinkedInstancesEditModal from "./LinkedInstancesEditModal";
import { UnsavedInstancesProvider, useUnsavedInstances } from "../contexts/UnsavedInstancesContext";
import { useQuerySpaces } from "../modules/query-builder/useQueryBuilderData";
import { useTypes } from "../hooks/useTypes";
import { fetchInstances } from "../services/instances";

vi.mock("../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});
vi.mock("../hooks/useTypes", () => ({ useTypes: vi.fn() }));
vi.mock("../hooks/useSpaces", () => ({ useSpaces: () => [] }));
vi.mock("../services/instances", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInstances: vi.fn().mockResolvedValue({ instances: [] }),
}));
vi.mock("../modules/query-builder/useQueryBuilderData", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuerySpaces: vi.fn(),
}));

const DEVICE = "https://example.org/types/Device";
const SERIAL_NUMBER = "https://example.org/serialNumber";

function DraftProbe({ onDrafts }: { onDrafts: (drafts: unknown[]) => void }) {
  const { drafts } = useUnsavedInstances();
  onDrafts(drafts);
  return null;
}

describe("LinkedInstancesEditModal", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(useQuerySpaces).mockReturnValue({
      data: [{ identifier: "shared", isPrivate: false, canCreate: true, canWrite: true, canDelete: false }],
    });
  });

  it.each([
    ["with the name as the value of the label field", SERIAL_NUMBER, { [SERIAL_NUMBER]: "SN-1" }],
    ["without field values if the type has no label field", undefined, {}],
  ])("keeps the type and the space of a created instance in its draft %s", async (_, labelProperty, fieldValues) => {
    vi.mocked(useTypes).mockReturnValue([{ identifier: DEVICE, name: "Device", labelProperty }]);
    let drafts: unknown[] = [];
    render(
      <UnsavedInstancesProvider>
        <DraftProbe onDrafts={(current) => (drafts = current)} />
        <LinkedInstancesEditModal
          show
          onHide={vi.fn()}
          fieldLabel="Devices"
          allowedTypes={[DEVICE]}
          linkedInstances={[]}
          onApply={vi.fn()}
        />
      </UnsavedInstancesProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Blade-Rack-A1"), { target: { value: "SN-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create & add", hidden: true }));

    await waitFor(() => expect(drafts).toHaveLength(1));
    expect(drafts[0]).toMatchObject({
      instanceName: "SN-1",
      type: "Device",
      typeIdentifier: DEVICE,
      space: "shared",
      isNew: true,
      fieldValues,
    });
  });

  describe("single", () => {
    const LINKED = { instanceId: "linked", instanceName: "Linked", type: "Device", space: "shared" };
    const OTHER = { instanceId: "other", instanceName: "Other", type: "Device", space: "shared" };
    let drafts: { instanceName: string }[] = [];

    function renderSingle(linkedInstances = [LINKED]) {
      vi.mocked(useTypes).mockReturnValue([{ identifier: DEVICE, name: "Device" }]);
      vi.mocked(fetchInstances).mockResolvedValue({ instances: [LINKED, OTHER] } as never);
      const onApply = vi.fn();
      render(
        <UnsavedInstancesProvider>
          <DraftProbe onDrafts={(current) => (drafts = current as { instanceName: string }[])} />
          <LinkedInstancesEditModal
            show
            single
            onHide={vi.fn()}
            fieldLabel="Device"
            allowedTypes={[DEVICE]}
            linkedInstances={linkedInstances}
            onApply={onApply}
          />
        </UnsavedInstancesProvider>,
      );
      return onApply;
    }

    const apply = () => fireEvent.click(screen.getByRole("button", { name: "Apply", hidden: true }));

    function create(name: string) {
      fireEvent.click(screen.getByRole("button", { name: "Create new instance", hidden: true }));
      fireEvent.change(screen.getByPlaceholderText("e.g. Blade-Rack-A1"), { target: { value: name } });
      fireEvent.click(screen.getByRole("button", { name: "Create & select", hidden: true }));
    }

    it("replaces the linked instance by the selected one", async () => {
      const onApply = renderSingle();

      fireEvent.click(await screen.findByRole("radio", { name: /Other/, hidden: true }));
      apply();

      expect(onApply.mock.calls[0][0]).toEqual([expect.objectContaining({ instanceId: "other" })]);
    });

    it("can remove the link", async () => {
      const onApply = renderSingle();

      await screen.findByRole("radio", { name: /Other/, hidden: true });
      fireEvent.click(screen.getByRole("button", { name: "Clear selection", hidden: true }));
      apply();

      expect(onApply).toHaveBeenCalledWith([]);
    });

    it("selects a created instance and only keeps the last one created", async () => {
      const onApply = renderSingle();

      await screen.findByRole("radio", { name: /Other/, hidden: true });
      create("First");
      await waitFor(() => expect(drafts).toHaveLength(1));
      create("Second");
      await waitFor(() => expect(drafts.map((draft) => draft.instanceName)).toEqual(["Second"]));
      expect(screen.queryByRole("radio", { name: /First/, hidden: true })).toBeNull();
      apply();

      expect(onApply.mock.calls[0][0]).toEqual([expect.objectContaining({ instanceName: "Second" })]);
    });
  });
  describe("search", () => {
    const LINKED = { instanceId: "linked", instanceName: "Linked", type: "Device", space: "shared" };
    // The core matches the term against the labels on its own terms - e.g. with another spelling
    const MATCH = { instanceId: "match", instanceName: "Rack A1", type: "Device", space: "shared" };

    function renderModal(single: boolean) {
      vi.mocked(useTypes).mockReturnValue([{ identifier: DEVICE, name: "Device" }]);
      vi.mocked(fetchInstances).mockReset();
      vi.mocked(fetchInstances).mockImplementation((_, query) =>
        Promise.resolve({ instances: query?.search ? [MATCH] : [LINKED, MATCH] } as never),
      );
      render(
        <UnsavedInstancesProvider>
          <LinkedInstancesEditModal
            show
            single={single}
            onHide={vi.fn()}
            fieldLabel="Devices"
            allowedTypes={[DEVICE]}
            linkedInstances={single ? [] : [LINKED]}
            onApply={vi.fn()}
          />
        </UnsavedInstancesProvider>,
      );
    }

    const searches = () => vi.mocked(fetchInstances).mock.calls.map(([, query]) => query?.search);

    it("asks the server for the instances matching the search and shows them as they are", async () => {
      renderModal(true);
      await screen.findByRole("radio", { name: /Linked/, hidden: true });

      fireEvent.change(screen.getByRole("searchbox", { name: "Search instances", hidden: true }), {
        target: { value: "rack-a" },
      });

      await waitFor(() => expect(searches()).toContain("rack-a"));
      expect(fetchInstances).toHaveBeenLastCalledWith("token", expect.objectContaining({ search: "rack-a", types: [DEVICE] }));
      await waitFor(() => expect(screen.queryByRole("radio", { name: /Linked/, hidden: true })).toBeNull());
      expect(screen.getByRole("radio", { name: /Rack A1/, hidden: true })).toBeInTheDocument();
    });

    it("waits for the typing to pause before asking the server", async () => {
      renderModal(true);
      await screen.findByRole("radio", { name: /Linked/, hidden: true });
      const searchbox = screen.getByRole("searchbox", { name: "Search instances", hidden: true });

      for (const value of ["r", "ra", "rac", "rack"]) {
        fireEvent.change(searchbox, { target: { value } });
      }

      await waitFor(() => expect(searches()).toContain("rack"));
      expect(searches().filter(Boolean)).toEqual(["rack"]);
    });

    it("searches the available instances of a multiple link on the server", async () => {
      renderModal(false);
      await screen.findByRole("checkbox", { name: /Rack A1/, hidden: true });

      fireEvent.change(screen.getByRole("searchbox", { name: "Search available instances", hidden: true }), {
        target: { value: "rack-a" },
      });

      await waitFor(() => expect(searches()).toContain("rack-a"));
      expect(screen.getByRole("checkbox", { name: /Rack A1/, hidden: true })).toBeInTheDocument();
    });
  });
});
