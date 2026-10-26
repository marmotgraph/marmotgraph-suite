import {
  defineProperty,
  incomingRelations,
  ModelType,
  relations,
  shortName,
  suggestIdentifier,
  typeName,
} from "./modeler";

const DEVICE = "https://example.org/types/Device";
const ROOM = "https://example.org/types/Room";

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
});
