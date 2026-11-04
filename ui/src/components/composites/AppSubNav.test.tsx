import React, { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AppSubNav from "./AppSubNav";
import { editorSubNav } from "../../modules/editor/editorSubNav";
import {
  UnsavedInstanceDraft,
  UnsavedInstancesProvider,
  useUnsavedInstances,
} from "../../contexts/UnsavedInstancesContext";
import UnsavedInstancesPanel from "../UnsavedInstancesPanel";
import { fetchTypes } from "../../services/types";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ getAccessToken: () => Promise.resolve("token") }),
}));

vi.mock("../../contexts/InstancesContext", () => ({
  useInstances: () => ({ addInstance: vi.fn(), instances: [] }),
}));

vi.mock("../../services/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/types")>()),
  fetchTypes: vi.fn(),
}));

const draft: UnsavedInstanceDraft = {
  instanceId: "inst-1",
  instanceName: "Headquarters",
  type: "Building",
  fieldValues: { name: "HQ" },
  baseline: { name: "Headquarters" },
  updatedAt: 1,
};

function Seed() {
  const { upsertDraft } = useUnsavedInstances();
  useEffect(() => {
    upsertDraft(draft);
  }, [upsertDraft]);
  return null;
}

function Location() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

describe("AppSubNav", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("creates another instance without dropping unsaved drafts", async () => {
    vi.mocked(fetchTypes).mockResolvedValue([
      { identifier: "https://example.org/types/Device", name: "Device" },
    ]);

    render(
      <MemoryRouter initialEntries={["/editor"]}>
        <UnsavedInstancesProvider>
          <Seed />
          <AppSubNav title={editorSubNav.title} ctas={editorSubNav.ctas} />
          <UnsavedInstancesPanel />
          <Routes>
            <Route path="*" element={<Location />} />
          </Routes>
        </UnsavedInstancesProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new instance" }));
    fireEvent.click(await screen.findByText("Device"));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      /^\/editor\/instances\/.+?\?new=1&type=https%3A%2F%2Fexample\.org%2Ftypes%2FDevice$/,
    );
    fireEvent.click(screen.getByRole("button", { name: /Expand unsaved instances panel/ }));
    expect(screen.getByRole("button", { name: "Save Headquarters" })).toBeInTheDocument();
  });
});
