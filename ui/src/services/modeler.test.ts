import {
  defineProperty,
  definePropertyOrder,
  describeWidget,
  effectiveSpecification,
  hasTypeSpecificValues,
  savePropertyDefinition,
  typeOverrides,
  incomingRelations,
  isRelationWidget,
  orderChanges,
  WIDGET_KINDS,
  widgetKind,
  widgetOf,
  ModelType,
  relations,
  shortName,
  suggestIdentifier,
  typeName,
} from "./modeler";

const DEVICE = "https://example.org/types/Device";
const ROOM = "https://example.org/types/Room";
const LOCATED_IN = "https://example.org/locatedIn";

const types: ModelType[] = [
  {
    identifier: DEVICE,
    name: "Device",
    embeddedOnly: false,
    spaces: [],
    properties: [
      { identifier: "https://schema.org/name", targetTypes: [] },
      { identifier: "https://example.org/locatedIn", name: "located in", targetTypes: [ROOM] },
      { identifier: "https://example.org/connectedTo", targetTypes: [DEVICE, ROOM] },
    ],
  },
  { identifier: ROOM, embeddedOnly: false, spaces: [], properties: [] },
];

describe("relations", () => {
  it("provides one relation per property and target type", () => {
    expect(relations(types)).toEqual([
      { source: DEVICE, target: ROOM, property: "https://example.org/locatedIn", label: "located in" },
      { source: DEVICE, target: DEVICE, property: "https://example.org/connectedTo", label: "connectedTo" },
      { source: DEVICE, target: ROOM, property: "https://example.org/connectedTo", label: "connectedTo" },
    ]);
  });

  it("provides the relations pointing to a type", () => {
    expect(incomingRelations(types, ROOM).map((r) => r.label)).toEqual(["located in", "connectedTo"]);
    expect(incomingRelations(types, "https://example.org/types/Unknown")).toEqual([]);
  });
});

describe("names", () => {
  it("falls back to the last segment of the identifier", () => {
    expect(typeName(types[1])).toBe("Room");
    expect(typeName(types[0])).toBe("Device");
    expect(shortName("https://schema.org#name")).toBe("name");
    expect(shortName("https://example.org/")).toBe("https://example.org/");
  });
});

describe("suggestIdentifier", () => {
  it("suggests the namespace of the example", () => {
    expect(suggestIdentifier("Building Part", DEVICE)).toBe("https://example.org/types/BuildingPart");
    expect(suggestIdentifier("name", "https://schema.org/description")).toBe("https://schema.org/name");
  });

  it("keeps full names", () => {
    expect(suggestIdentifier("https://other.org/Thing", DEVICE)).toBe("https://other.org/Thing");
  });

  it("keeps the name without example", () => {
    expect(suggestIdentifier(" Thing ")).toBe("Thing");
    expect(suggestIdentifier("", DEVICE)).toBe("");
  });
});

describe("requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes the identifiers as encoded query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await defineProperty("token", DEVICE, "https://example.org/locatedIn", { targetTypes: [ROOM] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "/api/modeler/types/properties?type=https%3A%2F%2Fexample.org%2Ftypes%2FDevice&property=https%3A%2F%2Fexample.org%2FlocatedIn",
    );
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ targetTypes: [ROOM] });
  });

  it("keeps the specification of a property when changing its order", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ type: { name: "located in", widget: "DynamicDropdown" }, global: { required: true } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await definePropertyOrder("token", DEVICE, "https://example.org/locatedIn", 3);

    const [, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ name: "located in", widget: "DynamicDropdown", orderNumber: 3 });
  });
});

describe("widgets", () => {
  it("groups the widgets differing only by cardinality", () => {
    expect(widgetKind("InputTextMultiple")).toEqual({ kind: expect.objectContaining({ key: "text" }), cardinality: "multiple" });
    const number = WIDGET_KINDS.find((kind) => kind.key === "number")!;
    expect(widgetOf(number, "single")).toBe("InputNumber");
    expect(widgetOf(number, "multiple")).toBe("InputNumberMultiple");
    // Kinds with a single cardinality only have one widget
    const table = WIDGET_KINDS.find((kind) => kind.key === "linkTable")!;
    expect(widgetOf(table, "single")).toBe("DynamicTable");
    expect(widgetKind("Unknown")).toBeUndefined();
  });

  it("makes properties with link widgets relations", () => {
    expect(isRelationWidget("SimpleDropdown")).toBe(true);
    expect(isRelationWidget("DynamicDropdown")).toBe(true);
    expect(isRelationWidget("Nested")).toBe(false);
    expect(isRelationWidget(undefined)).toBe(false);
  });

  it("describes the widgets", () => {
    expect(describeWidget("DynamicDropdown")).toBe("Links (dropdown), multiple values");
    expect(describeWidget("TextArea")).toBe("Long text");
    expect(describeWidget("Custom")).toBe("Custom");
    expect(describeWidget(undefined)).toBe("No widget");
  });
});

describe("orderChanges", () => {
  it("numbers only the properties whose position changes", () => {
    const [a, b, c] = ["a", "b", "c"].map((identifier, index) => ({ identifier, targetTypes: [], orderNumber: index + 1 }));
    expect(orderChanges([a, c, b]).map(({ property, orderNumber }) => [property.identifier, orderNumber])).toEqual([
      ["c", 2],
      ["b", 3],
    ]);
    expect(orderChanges([{ identifier: "x", targetTypes: [] }])).toEqual([
      { property: { identifier: "x", targetTypes: [] }, orderNumber: 1 },
    ]);
  });
});

describe("property definitions", () => {
  const global = { name: "located in", widget: "DynamicDropdown", targetTypes: [ROOM], required: true };

  it("takes the values not specified for the type from the global definition", () => {
    expect(effectiveSpecification({ type: { widget: "DynamicTable", targetTypes: [], orderNumber: 2 }, global })).toEqual({
      name: "located in",
      widget: "DynamicTable",
      targetTypes: [ROOM],
      required: true,
      orderNumber: 2,
      nameForReverseLink: undefined,
      readOnly: undefined,
      labelTooltip: undefined,
    });
  });

  it("stores only the values differing from the global definition for the type", () => {
    const overrides = typeOverrides({ ...global, targetTypes: [ROOM], widget: "DynamicTable", labelTooltip: "", orderNumber: 4 }, global);
    expect(overrides).toMatchObject({ name: null, widget: "DynamicTable", targetTypes: null, required: null, labelTooltip: null });
    // Without a global definition, all values are stored
    expect(typeOverrides({ name: "x", required: false }, null)).toMatchObject({ name: "x", required: null });
  });

  it("tells if the type defines more than the position of the property", () => {
    expect(hasTypeSpecificValues({ type: { orderNumber: 3, targetTypes: [] }, global })).toBe(false);
    expect(hasTypeSpecificValues({ type: { widget: "TextArea" }, global })).toBe(true);
    expect(hasTypeSpecificValues({ type: null, global })).toBe(false);
  });

  it("drops the values of the type when defining the property for all types", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await savePropertyDefinition("token", DEVICE, LOCATED_IN, { ...global, orderNumber: 9 }, "global", {
      type: { widget: "DynamicTable", orderNumber: 2 },
      global: { ...global, orderNumber: 5 },
    });

    const [[globalUrl, globalInit], [typeUrl, typeInit]] = fetchMock.mock.calls;
    expect(globalUrl).toBe(`/api/modeler/properties?property=${encodeURIComponent(LOCATED_IN)}`);
    // The global order is kept - the position in the form of the type is kept for the type
    expect(JSON.parse(globalInit.body)).toEqual({ ...global, orderNumber: 5 });
    expect(typeUrl).toContain("/api/modeler/types/properties?");
    expect(JSON.parse(typeInit.body)).toEqual({ orderNumber: 2 });
  });
});
