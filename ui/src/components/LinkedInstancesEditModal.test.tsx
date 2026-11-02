import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LinkedInstancesEditModal from "./LinkedInstancesEditModal";
import { UnsavedInstancesProvider, useUnsavedInstances } from "../contexts/UnsavedInstancesContext";
import { useQuerySpaces } from "../modules/query-builder/useQueryBuilderData";
import { useTypes } from "../hooks/useTypes";

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
});
