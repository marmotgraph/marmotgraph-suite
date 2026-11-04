import { appendIncomingLinks, IncomingLinks } from "./instances";

const link = (instanceId: string) => ({
  instanceId,
  instanceName: instanceId,
  space: "myspace",
});

const incomingLinks: IncomingLinks[] = [
  {
    property: "author",
    label: "Is author of",
    types: [
      {
        typeIdentifier: "Dataset",
        type: "Dataset",
        links: [link("a"), link("b")],
        total: 4,
        nextMarker: "m1",
      },
      {
        typeIdentifier: "Model",
        type: "Model",
        links: [link("x")],
        total: 3,
        nextMarker: "m2",
      },
    ],
  },
  {
    property: "contact",
    label: "Is contact of",
    types: [{ typeIdentifier: "Dataset", type: "Dataset", links: [link("c")] }],
  },
];

describe("appendIncomingLinks", () => {
  it("extends the links of the group by the following page", () => {
    const result = appendIncomingLinks(incomingLinks, "author", "Dataset", [
      {
        property: "author",
        label: "Is author of",
        types: [
          {
            typeIdentifier: "Dataset",
            type: "Dataset",
            links: [link("b"), link("c"), link("d")],
            total: 4,
            nextMarker: "m3",
          },
        ],
      },
    ]);

    expect(result[0].types[0].links.map((l) => l.instanceId)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(result[0].types[0].nextMarker).toBe("m3");
    expect(result[0].types[1]).toBe(incomingLinks[0].types[1]);
    expect(result[1]).toBe(incomingLinks[1]);
  });

  it("marks the group as exhausted if the following page is empty", () => {
    const result = appendIncomingLinks(incomingLinks, "author", "Model", []);

    expect(result[0].types[1].links).toEqual([link("x")]);
    expect(result[0].types[1].nextMarker).toBeUndefined();
  });
});
