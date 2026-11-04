import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import EditorHome from "./EditorHome";
import { useInstances } from "../../contexts/InstancesContext";
import { useTypes } from "../../hooks/useTypes";
import { useSpaces } from "../../hooks/useSpaces";
import { InstanceSummary } from "./editorMockData";
import { deleteInstance, fetchInstance } from "../../services/instances";

vi.mock("../../contexts/InstancesContext", () => ({ useInstances: vi.fn() }));
vi.mock("../../hooks/useTypes", () => ({ useTypes: vi.fn() }));
vi.mock("../../hooks/useSpaces", () => ({ useSpaces: vi.fn() }));
vi.mock("../../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});
vi.mock("../../services/instances", () => ({ deleteInstance: vi.fn(), fetchInstance: vi.fn() }));
const { removeDraft } = vi.hoisted(() => ({ removeDraft: vi.fn() }));
vi.mock("../../contexts/UnsavedInstancesContext", () => ({
  useUnsavedInstances: () => ({
    removeDraft,
    drafts: [],
    getDraft: () => undefined,
    upsertDraft: vi.fn(),
  }),
}));

const instance: InstanceSummary = {
  id: 1,
  instanceId: "inst-1",
  type: "Building",
  typeDescription: "A building",
  typeColor: "#4caf50",
  instanceName: "Headquarters",
  space: "default",
  permissions: "View, Edit",
  favorite: false,
  contributed: false,
  lastModified: "2026-01-01T10:00:00Z",
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

function renderHome(
  instances: InstanceSummary[] = [instance],
  total = instances.length,
  overrides: Partial<ReturnType<typeof useInstances>> = {},
) {
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
    total,
    loading: false,
    hasMore: false,
    loadingMore: false,
    loadMore: vi.fn(),
    searchTerm: "",
    setSearchTerm: vi.fn(),
    typeFilter: [],
    setTypeFilter: vi.fn(),
    spaceFilter: [],
    setSpaceFilter: vi.fn(),
    favoritesOnly: false,
    setFavoritesOnly: vi.fn(),
    contributedOnly: false,
    setContributedOnly: vi.fn(),
    releaseStatusFilter: [],
    setReleaseStatusFilter: vi.fn(),
    sort: { by: "LAST_MODIFICATION", direction: "DESC" },
    setSort: vi.fn(),
    toggleFavorite: vi.fn().mockResolvedValue(undefined),
    addInstance: vi.fn(),
    updateInstance: vi.fn(),
    deleteInstances: vi.fn(),
    getInstance: vi.fn(),
    requestInstances: vi.fn(),
    ...overrides,
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
    const headers = screen.getAllByRole("columnheader");
    expect(headers.at(-1)).toHaveAccessibleName("Permissions");
    expect(headers.at(-1)).toHaveTextContent("");
    expect(screen.getByText("released")).toBeInTheDocument();
    const minimal = screen.getByTitle('Validation "minimal": valid (100% compliant)');
    const complete = screen.getByTitle('Validation "complete": invalid (62% compliant)');
    expect(minimal.querySelector(".instance-validation-badge")).toHaveTextContent("minimal - 100%");
    expect(complete.querySelector(".instance-validation-badge")).toHaveTextContent("complete - 62%");
    expect(minimal.querySelector(".instance-validation-badge-bar")).toBeNull();
    expect(complete.querySelector(".instance-validation-badge-bar")).toBeNull();
  });

  it("filters by the release status on the backend - including instances which have changed since their release", () => {
    const setReleaseStatusFilter = vi.fn();
    renderHome(
      [instance, { ...instance, id: 2, instanceId: "inst-2", instanceName: "Warehouse", releaseStatus: "has changed" }],
      2,
      { releaseStatusFilter: ["released"], setReleaseStatusFilter },
    );

    expect(screen.getByText("has changed")).toHaveClass("instance-card-status--changed");

    fireEvent.click(screen.getByLabelText("Has Changed"));

    expect(setReleaseStatusFilter).toHaveBeenCalledWith(["released", "has changed"]);
  });

  it("shows the release status filter as a removable pill", () => {
    const setReleaseStatusFilter = vi.fn();
    renderHome([instance], 1, { releaseStatusFilter: ["in progress"], setReleaseStatusFilter });

    fireEvent.click(screen.getByRole("button", { name: "Remove Status filter" }));

    expect(setReleaseStatusFilter).toHaveBeenCalledWith([]);
  });

  it("shows the total number of instances reported by the service - not only the loaded ones", () => {
    renderHome([instance], 1234);

    expect(screen.getByText("1234 results")).toBeInTheDocument();
  });

  it("loads the following page from the backend once the end of the list is scrolled into view", () => {
    let intersect: IntersectionObserverCallback = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const loadMore = vi.fn();
    renderHome([instance], 1234, { hasMore: true, loadMore });

    expect(screen.getByText("Loading more instances...")).toBeInTheDocument();
    intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

    expect(loadMore).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("doesn't offer to load more if there are no further pages", () => {
    renderHome([instance], 1);

    expect(screen.queryByText("Loading more instances...")).not.toBeInTheDocument();
  });

  it("opens the instance page when a row is double clicked", async () => {
    renderHome();

    fireEvent.doubleClick(screen.getByText("Headquarters"));

    expect(await screen.findByText("instance detail")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/editor/instances/inst-1",
    );
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

  it("opens the instance in the mode of a permission icon", () => {
    renderHome([
      {
        ...instance,
        permissions: "View, Edit, Review, Release",
      },
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Open Headquarters in view mode" }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/editor/instances/inst-1",
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("?");
    expect(
      screen.queryByRole("complementary", { name: "Preview of Headquarters" }),
    ).not.toBeInTheDocument();

    cleanup();
    renderHome([
      {
        ...instance,
        permissions: "View, Edit, Review, Release",
      },
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "Open Headquarters in edit mode" }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/editor/instances/inst-1?edit=1",
    );

    cleanup();
    renderHome([
      {
        ...instance,
        permissions: "View, Edit, Review, Release",
      },
    ]);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Headquarters in release mode",
      }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/editor/instances/inst-1?release=1",
    );
  });

  it("disables the permission icons the user lacks and tells why", () => {
    renderHome([{ ...instance, permissions: "View" }]);

    expect(
      screen.getByRole("button", { name: "Open Headquarters in view mode" }),
    ).toBeEnabled();
    const release = screen.getByRole("button", {
      name: "Open Headquarters in release mode",
    });
    expect(release).toBeDisabled();
    expect(release.parentElement).toHaveAttribute(
      "title",
      "You don't have the permission to release this instance",
    );
    expect(
      screen.getByRole("button", { name: "Open Headquarters in edit mode" }),
    ).toBeDisabled();
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
      expect(card).toHaveTextContent("Last modified");
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

    expect(screen.getByLabelText("Show favorites only")).toBeInTheDocument();
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
      const setReleaseStatusFilter = vi.fn();
      renderHome([instance], 1, { releaseStatusFilter: ["released"], setReleaseStatusFilter });

      expect(
        screen.queryByLabelText("Show favorites only"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Type (0)" }),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Filters (1)" }));

      fireEvent.click(screen.getByLabelText("In Progress"));

      expect(setReleaseStatusFilter).toHaveBeenCalledWith(["released", "in progress"]);
      expect(screen.getByRole("heading", { name: "Type" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Space" })).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("flags an instance as favorite without opening its preview", () => {
    const toggleFavorite = vi.fn().mockResolvedValue(undefined);
    renderHome([instance], 1, { toggleFavorite });

    fireEvent.click(
      screen.getByRole("button", { name: "Add Headquarters to favorites" }),
    );

    expect(toggleFavorite).toHaveBeenCalledWith("inst-1");
    expect(
      screen.queryByRole("complementary", { name: "Preview of Headquarters" }),
    ).not.toBeInTheDocument();
  });

  it("shows a favorite as pressed star - in the list and in the preview", () => {
    const toggleFavorite = vi.fn().mockResolvedValue(undefined);
    renderHome([{ ...instance, favorite: true }], 1, { toggleFavorite });
    fireEvent.click(screen.getByText("Headquarters"));

    const stars = screen.getAllByRole("button", {
      name: "Remove Headquarters from favorites",
    });
    expect(stars).toHaveLength(2);
    stars.forEach((star) => expect(star).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(stars[1]);
    expect(toggleFavorite).toHaveBeenCalledWith("inst-1");
  });

  it("restricts the list to the favorites by the backend", () => {
    const setFavoritesOnly = vi.fn();
    renderHome([instance], 1, { setFavoritesOnly });

    fireEvent.click(screen.getByLabelText("Show favorites only"));

    expect(setFavoritesOnly).toHaveBeenCalledWith(true);
    // the total of the backend is still reported since the filter is not applied on the client
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("marks the instances the user has contributed to", () => {
    renderHome([
      { ...instance, contributed: true },
      { ...instance, instanceId: "inst-2", instanceName: "Branch office" },
    ]);

    expect(screen.getAllByText("my contribution")).toHaveLength(1);
  });

  it("restricts the list to the contributions of the user by the backend", () => {
    const setContributedOnly = vi.fn();
    renderHome([instance], 1, { setContributedOnly });

    fireEvent.click(screen.getByLabelText("Show my contributions only"));

    expect(setContributedOnly).toHaveBeenCalledWith(true);
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("shows the last modification of the instances - most recent first by default", () => {
    renderHome();

    const header = screen.getByRole("columnheader", { name: /Last modified/ });
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(
      screen.getByTitle("2026-01-01T10:00:00Z"),
    ).toHaveAttribute("dateTime", "2026-01-01T10:00:00Z");
  });

  it("sorts by the backend - ascending, descending, then by its default order", () => {
    const setSort = vi.fn();
    renderHome([instance], 1, { sort: null, setSort });

    fireEvent.click(screen.getByRole("columnheader", { name: /Type/ }));
    expect(setSort).toHaveBeenLastCalledWith({ by: "TYPE", direction: "ASC" });

    fireEvent.click(screen.getByRole("columnheader", { name: /Instance Name/ }));
    expect(setSort).toHaveBeenLastCalledWith({ by: "NAME", direction: "ASC" });
  });

  it("toggles the direction and resets the sorting of the current column", () => {
    const setSort = vi.fn();
    renderHome([instance], 1, { sort: { by: "NAME", direction: "ASC" }, setSort });
    fireEvent.click(screen.getByRole("columnheader", { name: /Instance Name/ }));
    expect(setSort).toHaveBeenLastCalledWith({ by: "NAME", direction: "DESC" });
  });

  it("resets the sorting after the descending order", () => {
    const setSort = vi.fn();
    renderHome([instance], 1, { sort: { by: "NAME", direction: "DESC" }, setSort });
    fireEvent.click(screen.getByRole("columnheader", { name: /Instance Name/ }));
    expect(setSort).toHaveBeenLastCalledWith(null);
  });

  describe("deleting the selection", () => {
    const headquarters: InstanceSummary = { ...instance, releaseStatus: "in progress" };
    const annex: InstanceSummary = { ...headquarters, id: 2, instanceId: "inst-2", instanceName: "Annex" };
    const releasedAnnex: InstanceSummary = { ...annex, releaseStatus: "released", permissions: "View, Edit, Release" };
    const RELEASED_OPTION = /Also delete released instances/;

    const openDeleteDialog = () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Select Headquarters" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Select Annex" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete Selected" }));
      return screen.getByRole("dialog");
    };

    beforeEach(() => {
      vi.mocked(deleteInstance).mockReset();
      removeDraft.mockClear();
    });

    it("deletes the instances on the backend and closes the dialog", async () => {
      vi.mocked(deleteInstance).mockResolvedValue(undefined);
      const deleteInstances = vi.fn();
      renderHome([headquarters, annex], 2, { deleteInstances });

      const dialog = openDeleteDialog();
      expect(deleteInstance).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(deleteInstance).toHaveBeenCalledWith("token", "inst-1");
      expect(deleteInstance).toHaveBeenCalledWith("token", "inst-2");
      expect(deleteInstances).toHaveBeenCalledWith(["inst-1", "inst-2"]);
      expect(removeDraft).toHaveBeenCalledWith("inst-1");
      expect(removeDraft).toHaveBeenCalledWith("inst-2");
      expect(screen.queryByRole("button", { name: "Delete Selected" })).not.toBeInTheDocument();
    });

    it("only deletes what is left on the list of the dialog", async () => {
      vi.mocked(deleteInstance).mockResolvedValue(undefined);
      const deleteInstances = vi.fn();
      renderHome([headquarters, annex], 2, { deleteInstances });

      const dialog = openDeleteDialog();
      fireEvent.click(within(dialog).getByText("Annex"));
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteInstances).toHaveBeenCalledWith(["inst-1"]));
      expect(deleteInstance).toHaveBeenCalledTimes(1);
    });

    it("keeps what the backend rejected selected and reports the failure", async () => {
      vi.mocked(deleteInstance).mockImplementation((_, id) =>
        id === "inst-2"
          ? Promise.reject(new Error("Failed to delete the instance (403 Forbidden)"))
          : Promise.resolve(),
      );
      const deleteInstances = vi.fn();
      renderHome([headquarters, annex], 2, { deleteInstances });

      const dialog = openDeleteDialog();
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "1 of 2 could not be deleted: Failed to delete the instance (403 Forbidden)",
      );
      expect(deleteInstances).toHaveBeenCalledWith(["inst-1"]);
      expect(removeDraft).toHaveBeenCalledTimes(1);
      expect(removeDraft).toHaveBeenCalledWith("inst-1");
      expect(within(dialog).getByText("Annex")).toBeInTheDocument();
      expect(within(dialog).queryByText("Headquarters")).not.toBeInTheDocument();
    });

    it("leaves the released instances out unless the user opts in", async () => {
      vi.mocked(deleteInstance).mockResolvedValue(undefined);
      const deleteInstances = vi.fn();
      renderHome([headquarters, releasedAnnex], 2, { deleteInstances });

      const dialog = openDeleteDialog();
      expect(within(dialog).getByRole("checkbox", { name: RELEASED_OPTION })).not.toBeChecked();
      expect(within(dialog).getByText("Will not be deleted")).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteInstances).toHaveBeenCalledWith(["inst-1"]));
      expect(deleteInstance).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Delete Selected" })).not.toBeInTheDocument();
    });

    it("also deletes the released instances if the user opts in", async () => {
      vi.mocked(deleteInstance).mockResolvedValue(undefined);
      const deleteInstances = vi.fn();
      renderHome([headquarters, releasedAnnex], 2, { deleteInstances });

      const dialog = openDeleteDialog();
      fireEvent.click(within(dialog).getByRole("checkbox", { name: RELEASED_OPTION }));
      expect(within(dialog).queryByText("Will not be deleted")).not.toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteInstances).toHaveBeenCalledWith(["inst-1", "inst-2"]));
    });

    it("treats an instance changed since its release as released", () => {
      renderHome([headquarters, { ...releasedAnnex, releaseStatus: "has changed" }], 2);

      const dialog = openDeleteDialog();

      expect(within(dialog).getByRole("checkbox", { name: RELEASED_OPTION })).toBeInTheDocument();
    });

    it("starts unselected again when reopened", () => {
      renderHome([headquarters, releasedAnnex], 2);

      const dialog = openDeleteDialog();
      fireEvent.click(within(dialog).getByRole("checkbox", { name: RELEASED_OPTION }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete Selected" }));

      expect(screen.getByRole("checkbox", { name: RELEASED_OPTION })).not.toBeChecked();
    });

    it("only deletes the remaining ones without the Release permission", async () => {
      vi.mocked(deleteInstance).mockResolvedValue(undefined);
      const deleteInstances = vi.fn();
      renderHome([headquarters, { ...annex, releaseStatus: "released" }], 2, { deleteInstances });

      const dialog = openDeleteDialog();
      expect(within(dialog).queryByRole("checkbox", { name: RELEASED_OPTION })).not.toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        "1 selected instance is released and can't be deleted without the Release permission. Only the remaining ones are deleted.",
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteInstances).toHaveBeenCalledWith(["inst-1"]));
      expect(deleteInstance).toHaveBeenCalledTimes(1);
    });

    it("has nothing to confirm if only released instances are selected without the Release permission", () => {
      renderHome([instance, { ...annex, releaseStatus: "released" }], 2);

      const dialog = openDeleteDialog();

      expect(dialog).toHaveTextContent(
        "2 selected instances are released and can't be deleted without the Release permission.",
      );
      expect(dialog).not.toHaveTextContent("Only the remaining ones");
      expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled();
    });

    it("cannot be confirmed with an empty list", () => {
      renderHome([headquarters, annex], 2);

      const dialog = openDeleteDialog();
      fireEvent.click(within(dialog).getByText("Annex"));
      fireEvent.click(within(dialog).getByText("Headquarters"));

      expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled();
    });
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
