import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InstanceDetail from "./InstanceDetail";
import {
  fetchIncomingLinks,
  fetchInstance,
  fetchRawInstance,
  fetchReleaseTree,
} from "../../services/instances";
import { UnsavedInstancesProvider } from "../../contexts/UnsavedInstancesContext";

vi.mock("../../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});

vi.mock("../../contexts/InstancesContext", () => ({
  useInstances: () => ({ addInstance: vi.fn(), instances: [] }),
}));

vi.mock("../../services/instances", () => ({
  fetchInstance: vi.fn(),
  fetchIncomingLinks: vi.fn(),
  fetchRawInstance: vi.fn(),
  fetchReleaseTree: vi.fn(),
  releaseInstance: vi.fn(),
  unreleaseInstance: vi.fn(),
  appendIncomingLinks: vi.fn(),
}));

function renderDetail(search = "") {
  vi.mocked(fetchInstance).mockResolvedValue({
    instanceId: "inst-1",
    type: "Building",
    instanceName: "Headquarters",
    space: "default",
    permissions: "View, Edit",
    releaseStatus: "released",
    fields: [],
    directLinks: [],
  });
  vi.mocked(fetchIncomingLinks).mockResolvedValue([]);
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
    <MemoryRouter initialEntries={[`/editor/instances/inst-1${search}`]}>
      <UnsavedInstancesProvider>
        <Routes>
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
  it("opens in view mode", async () => {
    renderDetail();

    expect(
      await screen.findByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
  });

  it("opens in edit mode when requested from the preview", async () => {
    renderDetail("?edit=1");

    expect(
      await screen.findByRole("button", { name: "Save" }),
    ).toBeInTheDocument();
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
    renderDetail("?release=1");

    expect(
      await screen.findByRole("button", { name: "Release" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByRole("list", { name: "Release tree" }),
    ).toBeInTheDocument();
  });

  it("switches to the release tree", async () => {
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Release" }));

    expect(
      await screen.findByRole("list", { name: "Release tree" }),
    ).toBeInTheDocument();
    expect(fetchReleaseTree).toHaveBeenCalledWith("token", "inst-1");
  });
});
