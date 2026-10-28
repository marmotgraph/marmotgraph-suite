import { describe, expect, it } from "vitest";
import type { QuerySpecification, QueryType } from "../../services/queries";
import {
  addField,
  defaultAlias,
  fieldFor,
  fieldProblem,
  fromSpecification,
  isFlattenedToRoot,
  moveField,
  newQuery,
  parameterNames,
  pathTo,
  removeField,
  setOption,
  toSpecification,
  TypesById,
  updateField,
} from "./queryModel";
import { availableProperties } from "./propertyGroups";

const PERSON = "https://example.org/types/Person";
const CITY = "https://example.org/types/City";
const COUNTRY = "https://example.org/types/Country";
const NAME = "https://schema.org/name";
const LIVES_IN = "https://example.org/livesIn";
const IN_COUNTRY = "https://example.org/country";

const typeList: QueryType[] = [
  {
    identifier: PERSON,
    name: "Person",
    color: "#ff0000",
    properties: [
      { identifier: NAME, label: "Name", reverse: false, targetTypes: [] },
      { identifier: LIVES_IN, label: "Lives in", reverse: false, targetTypes: [CITY] },
    ],
  },
  {
    identifier: CITY,
    name: "City",
    properties: [
      { identifier: NAME, label: "Name", reverse: false, targetTypes: [] },
      { identifier: IN_COUNTRY, label: "Country", reverse: false, targetTypes: [COUNTRY] },
      { identifier: LIVES_IN, label: "Inhabitants", reverse: true, targetTypes: [PERSON] },
    ],
  },
  {
    identifier: COUNTRY,
    name: "Country",
    properties: [
      { identifier: NAME, label: "Name", reverse: false, targetTypes: [] },
      { identifier: "https://example.org/code", label: "Code", reverse: false, targetTypes: [] },
    ],
  },
];
const types: TypesById = new Map(typeList.map((t) => [t.identifier, t]));
const property = (type: string, identifier: string, reverse = false) =>
  types.get(type)!.properties.find((p) => p.identifier === identifier && p.reverse === reverse)!;

describe("toSpecification", () => {
  it("translates fields, links and options", () => {
    const model = newQuery(PERSON, types);
    const name = fieldFor(property(PERSON, NAME));
    const livesIn = fieldFor(property(PERSON, LIVES_IN));
    const cityName = fieldFor(property(CITY, NAME));
    let root = addField(model.root, model.root.key, name);
    root = addField(root, root.key, livesIn);
    root = addField(root, livesIn.key, cityName);
    root = setOption(root, name.key, "required", true);
    root = setOption(root, cityName.key, "filter", { op: "CONTAINS", parameter: "city" });
    root = updateField(root, livesIn.key, (f) => ({ ...f, alias: "home", typeFilter: [CITY] }));

    const specification = toSpecification({ ...model, root, label: " People ", description: "" });

    expect(specification).toEqual({
      meta: { type: PERSON, name: "People" },
      structure: [
        { propertyName: "name", required: true, path: [{ property: NAME }] },
        {
          propertyName: "home",
          path: [{ property: LIVES_IN, typeFilter: [CITY] }],
          structure: [
            { propertyName: "name", filter: { op: "CONTAINS", parameter: "city" }, path: [{ property: NAME }] },
          ],
        },
      ],
    });
  });

  it("merges the path of flattened fields", () => {
    const model = newQuery(CITY, types);
    const inhabitants = fieldFor(property(CITY, LIVES_IN, true));
    const name = fieldFor(property(PERSON, NAME));
    let root = addField(model.root, model.root.key, inhabitants);
    root = addField(root, inhabitants.key, name);
    root = updateField(root, inhabitants.key, (f) => ({ ...f, isFlattened: true }));
    root = setOption(root, inhabitants.key, "required", true);
    root = setOption(root, inhabitants.key, "ensureOrder", true);
    root = setOption(root, name.key, "sort", true);

    expect(toSpecification({ ...model, root }).structure).toEqual([
      {
        propertyName: "livesIn",
        required: true,
        ensureOrder: true,
        path: [{ property: LIVES_IN, reverse: true }, { property: NAME }],
        sort: true,
      },
    ]);
  });

  it("only gives the root type for a query without fields", () => {
    expect(toSpecification(newQuery(PERSON, types))).toEqual({ meta: { type: PERSON } });
  });
});

describe("fromSpecification", () => {
  const specification = {
    meta: { type: CITY, name: "Cities", description: "With people" },
    structure: [
      { propertyName: "name", path: [{ property: NAME }], required: true },
      {
        propertyName: "people",
        path: [{ property: LIVES_IN, reverse: true }, { property: NAME }],
        required: true,
        ensureOrder: true,
        sort: true,
      },
      {
        propertyName: "country",
        path: [{ property: IN_COUNTRY, typeFilter: [COUNTRY] }],
        singleValue: "FIRST" as const,
        structure: [{ propertyName: "iso", path: [{ property: "https://example.org/code" }] }],
      },
      { propertyName: "unknown", path: [{ property: "https://example.org/nope" }] },
    ],
  };

  it("restores the field tree", () => {
    const model = fromSpecification(specification, types);
    expect(model.rootType).toBe(CITY);
    expect(model.label).toBe("Cities");
    expect(model.description).toBe("With people");
    const [name, people, country, unknown] = model.root.children;

    expect(name.schema).toMatchObject({ identifier: NAME, label: "Name" });
    expect(name.options).toEqual({ required: true });
    expect(name.alias).toBeUndefined();

    expect(people.isFlattened).toBe(true);
    expect(people.schema).toMatchObject({ identifier: LIVES_IN, reverse: true, targetTypes: [PERSON] });
    expect(people.alias).toBe("people");
    expect(people.options).toEqual({ required: true, ensureOrder: true });
    expect(people.children[0].schema.identifier).toBe(NAME);
    expect(people.children[0].options).toEqual({ sort: true });

    expect(country.typeFilter).toEqual([COUNTRY]);
    expect(country.options).toEqual({ singleValue: "FIRST" });
    expect(country.children[0].alias).toBe("iso");
    expect(country.children[0].isUnknown).toBe(false);

    expect(unknown.isUnknown).toBe(true);
    expect(fieldProblem(unknown, false)).toBeDefined();
  });

  it("produces the same specification again", () => {
    expect(toSpecification(fromSpecification(specification, types))).toEqual(specification);
  });

  it("accepts the short forms of paths and structures", () => {
    const model = fromSpecification(
      {
        meta: { type: PERSON },
        structure: {
          propertyName: "home",
          path: { property: LIVES_IN, typeFilter: CITY },
          structure: { path: NAME },
        },
      } as unknown as QuerySpecification,
      types,
    );
    const [home] = model.root.children;
    expect(home.typeFilter).toEqual([CITY]);
    expect(home.children[0].schema.identifier).toBe(NAME);
  });

  it("keeps the result key of fields without a property name", () => {
    const model = fromSpecification({ meta: { type: PERSON }, structure: [{ path: [{ property: NAME }] }] }, types);
    expect(toSpecification(model).structure).toEqual([{ propertyName: NAME, path: [{ property: NAME }] }]);
  });

  it("drops options the core doesn't know", () => {
    const model = fromSpecification(
      {
        meta: { type: PERSON },
        structure: [{ propertyName: "name", path: [{ property: NAME }], merge: true }],
      } as unknown as QuerySpecification,
      types,
    );
    expect(model.root.children[0].options).toEqual({});
  });

  it("flags an unknown root type", () => {
    expect(fromSpecification({ meta: { type: "https://example.org/Nope" } }, types).root.isUnknown).toBe(true);
  });
});

describe("tree operations", () => {
  const build = () => {
    const model = newQuery(PERSON, types);
    const name = fieldFor(property(PERSON, NAME));
    const livesIn = fieldFor(property(PERSON, LIVES_IN));
    let root = addField(model.root, model.root.key, name);
    root = addField(root, root.key, livesIn);
    return { root, name, livesIn };
  };

  it("moves, removes and only allows a single sort", () => {
    const { root, name, livesIn } = build();
    const moved = moveField(root, livesIn.key, -1);
    expect(moved.children.map((f) => f.key)).toEqual([livesIn.key, name.key]);
    expect(moveField(moved, livesIn.key, -1)).toBe(moved);

    const cityName = fieldFor(property(CITY, NAME));
    let sorted = addField(root, livesIn.key, cityName);
    sorted = setOption(sorted, name.key, "sort", true);
    sorted = setOption(sorted, cityName.key, "sort", true);
    expect(pathTo(sorted, name.key).at(-1)!.options.sort).toBeUndefined();
    expect(pathTo(sorted, cityName.key).at(-1)!.options.sort).toBe(true);

    expect(removeField(root, name.key).children.map((f) => f.key)).toEqual([livesIn.key]);
  });

  it("reports links without children and derives names", () => {
    const { root, livesIn } = build();
    expect(fieldProblem(root.children[1], false)).toMatch(/child/);
    expect(defaultAlias(livesIn)).toBe("livesIn");
    const cityName = fieldFor(property(CITY, NAME));
    const withChild = updateField(addField(root, livesIn.key, cityName), livesIn.key, (f) => ({ ...f, isFlattened: true }));
    expect(isFlattenedToRoot(pathTo(withChild, cityName.key))).toBe(true);
    expect(isFlattenedToRoot(pathTo(addField(root, livesIn.key, cityName), cityName.key))).toBe(false);
  });

  it("collects the filter parameters - without the reserved ones", () => {
    const { root, name, livesIn } = build();
    let withFilters = setOption(root, name.key, "filter", { op: "EQUALS", parameter: " name " });
    withFilters = setOption(withFilters, livesIn.key, "filter", { op: "EQUALS", parameter: "size" });
    expect(parameterNames(withFilters)).toEqual(["name"]);
  });
});

describe("availableProperties", () => {
  it("separates common and type specific properties", () => {
    const available = availableProperties(types, [CITY, COUNTRY], "", false);
    expect(available.commonAttributes.map((p) => p.identifier)).toEqual([NAME]);
    expect(available.attributesByType).toEqual([
      { type: COUNTRY, properties: [property(COUNTRY, "https://example.org/code")] },
    ]);
    expect(available.linksByType.map((g) => g.type)).toEqual([CITY]);
    expect(available.count).toBe(4);
  });

  it("treats all properties of a single type as common and filters them", () => {
    const available = availableProperties(types, [PERSON], "city", false);
    expect(available.commonLinks.map((p) => p.identifier)).toEqual([LIVES_IN]);
    expect(available.commonAttributes).toEqual([]);
  });
});
