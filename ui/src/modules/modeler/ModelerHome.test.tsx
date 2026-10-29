import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ModelerHome from "./ModelerHome";
import { POSITIONS_KEY } from "./nodePositions";
import AppSubNav from "../../components/composites/AppSubNav";
import { SubNavActionsProvider } from "../../contexts/SubNavActionsContext";
import { useGlobalFunctionalities } from "../../hooks/useGlobalFunctionalities";
import {
  fetchModel,
  savePropertyDefinition,
  definePropertyOrder,
  fetchPropertyDefinitions,
  fetchPropertySources,
  fetchTypeSpecification,
  fetchSpecificationStatus,
  ModelType,
} from "../../services/modeler";

vi.mock("../../contexts/AuthContext", () => {
  const getAccessToken = () => Promise.resolve("token");
  return { useAuth: () => ({ getAccessToken }) };
});
vi.mock("../../hooks/useGlobalFunctionalities", () => ({ useGlobalFunctionalities: vi.fn() }));
vi.mock("../../hooks/useSpaces", () => ({ useSpaces: () => [] }));
vi.mock("../../services/modeler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/modeler")>()),
  fetchModel: vi.fn(),
  fetchTypeSpecification: vi.fn(),
  fetchValidationSchemas: vi.fn().mockResolvedValue([]),
  fetchAssignedSpaces: vi.fn().mockResolvedValue([]),
  fetchSpecificationStatus: vi.fn().mockResolvedValue({}),
  fetchPropertySources: vi.fn().mockResolvedValue({}),
  fetchPropertyDefinitions: vi.fn().mockResolvedValue({ type: null, global: null }),
  savePropertyDefinition: vi.fn().mockResolvedValue(undefined),
  definePropertyOrder: vi.fn().mockResolvedValue(undefined),
}));

const DEVICE = "https://example.org/types/Device";
const ROOM = "https://example.org/types/Room";

const TYPES: ModelType[] = [
  {
    identifier: DEVICE,
    name: "Device",
    color: "#ff9800",
    embeddedOnly: false,
    occurrences: 3,
    spaces: ["myspace"],
    properties: [
      { identifier: "https://schema.org/name", name: "name", widget: "InputText", required: true, targetTypes: [] },
      { identifier: "https://example.org/locatedIn", name: "located in", widget: "DynamicDropdown", targetTypes: [ROOM] },
    ],
  },
  { identifier: ROOM, name: "Room", embeddedOnly: false, spaces: [], properties: [] },
  { identifier: "https://example.org/types/Building", name: "Building", embeddedOnly: false, spaces: [], properties: [] },
];

function Location() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

/** Admins who may only define validation schemas - the types are shown read-only */
const SCHEMA_ADMIN = ["DEFINE_VALIDATION_SCHEMAS"];

function renderAt(path: string, functionalities: string[] = SCHEMA_ADMIN) {
  vi.mocked(useGlobalFunctionalities).mockReturnValue(functionalities);
  vi.mocked(fetchModel).mockResolvedValue(TYPES);
  vi.mocked(fetchTypeSpecification).mockResolvedValue(undefined);
  render(
    <MemoryRouter initialEntries={[path]}>
      <SubNavActionsProvider>
        <AppSubNav ctas={[]} />
        <Routes>
          <Route path="modeler/*" element={<ModelerHome />} />
        </Routes>
      </SubNavActionsProvider>
      <Location />
    </MemoryRouter>,
  );
}

describe("ModelerHome", () => {
  it("redirects to the list of the types", async () => {
    renderAt("/modeler");
    expect(await screen.findByText("3 types")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe("/modeler/types");
  });

  it("filters the types", async () => {
    renderAt("/modeler/types");
    fireEvent.change(await screen.findByLabelText("Filter types"), { target: { value: "roo" } });
    expect(screen.getByText("1 of 3 types")).toBeInTheDocument();
  });

  it("shows the properties and relations of the selected type", async () => {
    renderAt(`/modeler/types?type=${encodeURIComponent(DEVICE)}`);
    expect(await screen.findByText("https://example.org/locatedIn")).toBeInTheDocument();
    const row = screen.getByText("https://example.org/locatedIn").closest<HTMLElement>("[data-testid=modeler-field]")!;
    expect(within(row).getByText("Room")).toBeInTheDocument();
    // The properties are shown as in the form of the editor - with an example of their widget
    expect(within(row).getByText("Links (dropdown), multiple values")).toBeInTheDocument();
    expect(within(row).getByText("Room A")).toBeInTheDocument();
    expect(screen.queryByText("Add property")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Move /)).not.toBeInTheDocument();
  });

  it("changes the order of the properties", async () => {
    vi.mocked(definePropertyOrder).mockClear();
    renderAt(`/modeler/types?type=${encodeURIComponent(DEVICE)}`, ["DEFINE_TYPES_AND_PROPERTIES"]);
    fireEvent.keyDown(await screen.findByLabelText("Move located in (position 2 of 2)"), { key: "ArrowUp" });
    // The new order is shown while it is saved
    const names = screen.getAllByTestId("modeler-field").map((field) => field.querySelector(".modeler-field-label")?.textContent);
    expect(names).toEqual(["located in", "name *"]);
    expect(screen.getByText("located in moved to position 1 of 2.")).toBeInTheDocument();
    await vi.waitFor(() => expect(definePropertyOrder).toHaveBeenCalledTimes(2));
    expect(definePropertyOrder).toHaveBeenCalledWith("token", DEVICE, "https://example.org/locatedIn", 1);
    expect(definePropertyOrder).toHaveBeenCalledWith("token", DEVICE, "https://schema.org/name", 2);
  });

  it("defines a relation by the widget of a property", async () => {
    vi.mocked(savePropertyDefinition).mockClear();
    renderAt(`/modeler/types?type=${encodeURIComponent(DEVICE)}`, ["DEFINE_TYPES_AND_PROPERTIES"]);
    fireEvent.click(await screen.findByText("Add property"));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "contains" } });
    expect(within(dialog).queryByText("Links to")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Widget"), { target: { value: "link" } });
    // The cardinality decides between the widgets of the kind
    fireEvent.click(screen.getByLabelText("Multiple"));
    expect(within(dialog).getByText("Links to")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText("Building"));
    expect(within(dialog).getByText("Building A")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Save"));
    await vi.waitFor(() =>
      expect(savePropertyDefinition).toHaveBeenCalledWith(
        "token",
        DEVICE,
        "https://schema.org/contains",
        expect.objectContaining({ widget: "DynamicDropdown", targetTypes: ["https://example.org/types/Building"], orderNumber: 3 }),
        "type",
        { type: null, global: null },
      ),
    );
  });

  it("defines a property for the type or for all types", async () => {
    vi.mocked(savePropertyDefinition).mockClear();
    // The property is only defined globally (the type only places it) - it is edited globally
    const definitions = { type: { orderNumber: 1 }, global: { name: "name", widget: "InputText" } };
    vi.mocked(fetchPropertyDefinitions).mockResolvedValue(definitions);
    renderAt(`/modeler/types?type=${encodeURIComponent(DEVICE)}`, ["DEFINE_TYPES_AND_PROPERTIES"]);
    fireEvent.click(await screen.findByLabelText("Edit name"));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByLabelText("All types")).toBeChecked();
    fireEvent.change(within(dialog).getByLabelText("Tooltip"), { target: { value: "The name" } });
    fireEvent.click(within(dialog).getByText("Save"));
    await vi.waitFor(() =>
      expect(savePropertyDefinition).toHaveBeenCalledWith(
        "token",
        DEVICE,
        "https://schema.org/name",
        expect.objectContaining({ labelTooltip: "The name", widget: "InputText" }),
        "global",
        definitions,
      ),
    );

    // The scope can be changed to the type only
    fireEvent.click(await screen.findByLabelText("Edit name"));
    const second = await screen.findByRole("dialog");
    fireEvent.click(await within(second).findByLabelText("Device only"));
    expect(within(second).getByText(/Only the values differing from the global definition are stored/)).toBeInTheDocument();
    fireEvent.click(within(second).getByText("Save"));
    await vi.waitFor(() => expect(savePropertyDefinition).toHaveBeenLastCalledWith("token", DEVICE, "https://schema.org/name", expect.anything(), "type", definitions));
    vi.mocked(fetchPropertyDefinitions).mockResolvedValue({ type: null, global: null });
  });

  it("allows to modify the model with the rights to define types", async () => {
    renderAt(`/modeler/types?type=${encodeURIComponent(DEVICE)}`, ["DEFINE_TYPES_AND_PROPERTIES"]);
    expect(await screen.findByText("Add property")).toBeInTheDocument();
    // Creating a type is the page action in the subnav
    fireEvent.click(screen.getByText("Create new type"));
    expect(await screen.findByText("New type")).toBeInTheDocument();
  });

  it("offers no page action without the rights to define types", async () => {
    renderAt("/modeler/types");
    expect(await screen.findByText("3 types")).toBeInTheDocument();
    expect(screen.queryByText("Create new type")).not.toBeInTheDocument();
  });

  it("keeps the selected type when switching to the graph", async () => {
    renderAt(`/modeler/types?type=${encodeURIComponent(DEVICE)}`);
    fireEvent.click(await screen.findByText("Graph"));
    expect(await screen.findByLabelText("Graph of the types and their relations")).toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toBe(`/modeler/graph?type=${encodeURIComponent(DEVICE)}`);
    expect(screen.getAllByTestId("modeler-node")).toHaveLength(3);
    expect(screen.getByText("Edit type")).toBeInTheDocument();
  });

  it("shows only the neighbours of the selection in the graph", async () => {
    renderAt(`/modeler/graph?type=${encodeURIComponent(DEVICE)}`);
    fireEvent.click(await screen.findByLabelText("Only neighbours of the selection"));
    expect(screen.getAllByTestId("modeler-node")).toHaveLength(2);
  });

  it("keeps the arrangement of the types", async () => {
    localStorage.clear();
    renderAt("/modeler/graph");
    const device = (await screen.findAllByTestId("modeler-node")).find((node) => node.textContent?.includes("Device"))!;
    const before = device.getAttribute("transform");
    // d3 listens to the moves on the window the drag started in (jsdom doesn't accept its window as view of an event)
    const mouse = (target: EventTarget, type: string, clientX: number, clientY: number) =>
      act(() => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
        Object.defineProperty(event, "view", { value: window });
        target.dispatchEvent(event);
      });
    mouse(device, "mousedown", 100, 100);
    mouse(window, "mousemove", 150, 130);
    mouse(window, "mouseup", 150, 130);

    const stored = JSON.parse(localStorage.getItem(POSITIONS_KEY)!);
    // All shown types are fixed - the dragged one where it was dropped
    expect(Object.keys(stored).sort()).toEqual(TYPES.map((t) => t.identifier).sort());
    const [x, y] = stored[DEVICE];
    expect(device.getAttribute("transform")).toBe(`translate(${x} ${y})`);
    expect(device.getAttribute("transform")).not.toBe(before);
    // The selection is not changed by dragging
    expect(screen.getByTestId("location").textContent).toBe("/modeler/graph");

    // d3 suppresses the click right after a drag
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    fireEvent.click(screen.getByLabelText("Reset arrangement"));
    expect(localStorage.getItem(POSITIONS_KEY)).toBeNull();
  });

  it("shows the types at their stored position", async () => {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify({ [DEVICE]: [500, -250] }));
    renderAt("/modeler/graph");
    const device = (await screen.findAllByTestId("modeler-node")).find((node) => node.textContent?.includes("Device"))!;
    expect(device.getAttribute("transform")).toBe("translate(500 -250)");
    localStorage.clear();
  });

  it("is only available to admins", async () => {
    vi.mocked(fetchModel).mockClear();
    renderAt("/modeler/types", ["READ"]);
    expect(await screen.findByText("The modeler is only available to administrators.")).toBeInTheDocument();
    expect(fetchModel).not.toHaveBeenCalled();
  });

  it("reports when the types can't be loaded", async () => {
    vi.mocked(useGlobalFunctionalities).mockReturnValue(SCHEMA_ADMIN);
    vi.mocked(fetchModel).mockRejectedValue(new Error("Failed to load the types (500)"));
    render(
      <MemoryRouter initialEntries={["/modeler/types"]}>
        <Routes>
          <Route path="modeler/*" element={<ModelerHome />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Failed to load the types (500)")).toBeInTheDocument();
  });
});
