import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import EditorHome from "./EditorHome";
import { useInstances } from "../../contexts/InstancesContext";
import { useTypes } from "../../hooks/useTypes";
import { useSpaces } from "../../hooks/useSpaces";
import { InstanceSummary } from "./editorMockData";
import { fetchInstance } from "../../services/instances";

vi.mock("../../contexts/InstancesContext", () => ({ useInstances: vi.fn() }));
vi.mock("../../hooks/useTypes", () => ({ useTypes: vi.fn() }));
vi.mock("../../hooks/useSpaces", () => ({ useSpaces: vi.fn() }));
vi.mock("../../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});
vi.mock("../../services/instances", () => ({ fetchInstance: vi.fn() }));

const instance: InstanceSummary = {
  id: 1,
  instanceId: "inst-1",
  type: "Building",
  typeDescription: "A building",
  typeColor: "#4caf50",
  instanceName: "Headquarters",
  space: "default",
  permissions: "View, Edit",
  bookmarked: false,
  lastVisited: "2026-01-01",
  releaseStatus: "released",
  validation: [
    { name: "minimal", valid: true, compliance: 100 },
    { name: "complete", valid: false, compliance: 62.5 },
  ],
};

function Location() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderHome(instances: InstanceSummary[] = [instance]) {
  vi.mocked(useTypes).mockReturnValue([]);
  vi.mocked(useSpaces).mockReturnValue([]);
  vi.mocked(fetchInstance).mockResolvedValue({
    instanceId: instance.instanceId,
    type: instance.type,
    instanceName: instance.instanceName,
    space: instance.space,
    permissions: instance.permissions,
    releaseStatus: instance.releaseStatus,
    fields: [
      {
        identifier: "city",
        label: "City",
        kind: "TEXT",
        value: "Zurich",
        required: false,
        readOnly: false,
      },
    ],
  });
  vi.mocked(useInstances).mockReturnValue({
    instances,
    loading: false,
    searchTerm: "",
    setSearchTerm: vi.fn(),
    typeFilter: [],
    setTypeFilter: vi.fn(),
    spaceFilter: [],
    setSpaceFilter: vi.fn(),
    addInstance: vi.fn(),
    updateInstance: vi.fn(),
    deleteInstances: vi.fn(),
    getInstance: vi.fn(),
    requestInstances: vi.fn(),
  });

  render(
    <MemoryRouter initialEntries={["/editor"]}>
      <Routes>
        <Route path="/editor" element={<EditorHome />} />
        <Route
          path="/editor/instances/:instanceId"
          element={<div>instance detail</div>}
        />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
}

describe("EditorHome", () => {
  it("shows the release status and a tag with the compliance per validation schema", () => {
    renderHome();

    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("released")).toBeInTheDocument();
    expect(screen.getByTitle('Validation "minimal": valid (100% compliant)')).toHaveTextContent("minimal100%");
    expect(screen.getByTitle('Validation "complete": invalid (62% compliant)')).toHaveTextContent("complete62%");
  });

  it("filters by the release status - including instances which have changed since their release", () => {
    renderHome([
      instance,
      { ...instance, id: 2, instanceId: "inst-2", instanceName: "Warehouse", releaseStatus: "has changed" },
      { ...instance, id: 3, instanceId: "inst-3", instanceName: "Garage", releaseStatus: "in progress" },
    ]);

    expect(screen.getByText("has changed")).toHaveClass("instance-card-status--changed");

    fireEvent.click(screen.getByLabelText("Has Changed"));

    expect(screen.getByText("Warehouse")).toBeInTheDocument();
    expect(screen.queryByText("Headquarters")).not.toBeInTheDocument();
    expect(screen.queryByText("Garage")).not.toBeInTheDocument();
  });

  it("opens a preview instead of the instance page when a row is clicked", async () => {
    renderHome();

    fireEvent.click(screen.getByText("Headquarters"));

    expect(await screen.findByText("Zurich")).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Preview of Headquarters" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Headquarters" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Building").length).toBeGreaterThan(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/editor");
    expect(screen.queryByText("instance detail")).not.toBeInTheDocument();
  });

  it("opens the instance page from the preview", () => {
    renderHome();
    fireEvent.click(screen.getByText("Headquarters"));

    fireEvent.click(screen.getByRole("button", { name: "Open instance" }));

    expect(screen.getByText("instance detail")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/editor/instances/inst-1",
    );
  });

  it("opens the instance page in edit mode from the preview", () => {
    renderHome();
    fireEvent.click(screen.getByText("Headquarters"));

    fireEvent.click(screen.getByRole("button", { name: "Edit instance" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/editor/instances/inst-1?edit=1",
    );
  });

  it("opens the instance page in raw mode from the preview", () => {
    renderHome();
    fireEvent.click(screen.getByText("Headquarters"));

    fireEvent.click(
      screen.getByRole("button", { name: "Open instance in raw mode" }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/editor/instances/inst-1?raw=1",
    );
  });

  it("shows the instance id, space, and fields", async () => {
    renderHome();
    fireEvent.click(screen.getByText("Headquarters"));

    const preview = screen.getByRole("complementary", {
      name: "Preview of Headquarters",
    });
    expect(preview).toHaveTextContent("inst-1");
    expect(preview).toHaveTextContent("Space");
    expect(preview).toHaveTextContent("default");
    expect(await screen.findByText("City")).toBeInTheDocument();
    expect(screen.getByText("Zurich")).toBeInTheDocument();
  });

  it("copies the instance id from the preview", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderHome();
    fireEvent.click(screen.getByText("Headquarters"));
    await screen.findByText("Zurich");
    await waitFor(() => {
      expect(screen.queryByText("Loading fields...")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy ID" }));

    expect(writeText).toHaveBeenCalledWith("inst-1");
    expect(
      screen.getByRole("button", { name: "ID copied" }),
    ).toBeInTheDocument();
  });

  it("uses a card on a narrow screen and keeps secondary fields collapsed", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      renderHome();

      const card = screen.getByRole("article", { name: "Headquarters" });
      expect(card).toHaveTextContent("Building");
      expect(card).toHaveTextContent("inst-1");
      expect(card).not.toHaveTextContent("released");
      expect(card).not.toHaveTextContent("default");
      expect(
        screen.queryByRole("complementary", { name: "Preview of Headquarters" }),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Details" }));

      expect(card).toHaveTextContent("released");
      expect(card).toHaveTextContent("default");
      expect(card).toHaveTextContent("View");
      expect(card).toHaveTextContent("Edit");
      expect(card).toHaveTextContent("2026-01-01");
      expect(
        screen.queryByRole("complementary", { name: "Preview of Headquarters" }),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("heading", { name: "Headquarters" }));

      expect(
        screen.getByRole("complementary", { name: "Preview of Headquarters" }),
      ).toBeInTheDocument();
      expect(await screen.findByText("Zurich")).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("keeps filters inline on a wide screen", () => {
    renderHome();

    expect(screen.getByLabelText("Show bookmarked only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type (0)" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Filters" }),
    ).not.toBeInTheDocument();
  });

  it("groups filters behind one button on a narrow screen", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      renderHome();

      expect(
        screen.queryByLabelText("Show bookmarked only"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Type (0)" }),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Filters" }));

      fireEvent.click(screen.getByLabelText("Show bookmarked only"));
      fireEvent.click(screen.getByLabelText("Released"));

      expect(
        screen.getByRole("button", { name: "Filters (2)" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Type" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Space" })).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("closes the preview", () => {
    renderHome();
    fireEvent.click(screen.getByText("Headquarters"));

    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));

    expect(
      screen.queryByRole("complementary", { name: "Preview of Headquarters" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/editor");
  });
});
