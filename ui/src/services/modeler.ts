import { getJson, send } from "./http";

/** A property of a type - as observed in the data, extended by its specification. */
export interface ModelProperty {
  identifier: string;
  name?: string;
  nameForReverseLink?: string;
  widget?: string;
  required?: boolean;
  orderNumber?: number;
  occurrences?: number;
  /** The types the property links to - empty if it is no relation */
  targetTypes: string[];
}

export interface ModelType {
  identifier: string;
  name?: string;
  description?: string;
  color?: string;
  labelProperty?: string;
  embeddedOnly: boolean;
  occurrences?: number;
  properties: ModelProperty[];
  /** The spaces the type occurs in */
  spaces: string[];
}

/** The editable definition of a type. */
export interface TypeSpecification {
  name?: string;
  description?: string;
  color?: string;
  labelProperty?: string;
  searchableProperties?: string[];
  embeddedOnly: boolean;
}

/** The editable definition of a property of a type - a property with target types is a relation. */
export interface PropertySpecification {
  name?: string;
  nameForReverseLink?: string;
  targetTypes?: string[];
  widget?: string;
  readOnly?: boolean;
  labelTooltip?: string;
  required?: boolean;
  orderNumber?: number;
}

/** A named JSON-Schema document attached to a type. */
export interface ValidationSchema {
  name: string;
  schema: Record<string, unknown>;
}

/** A relation between two types (derived from the target types of the properties). */
export interface Relation {
  source: string;
  target: string;
  property: string;
  label: string;
}

/** If a property holds a single value or a list of values. */
export type Cardinality = "single" | "multiple";

/**
 * A kind of widget - the widgets the core knows to show properties with, grouped by what they show. Several widgets
 * only differ in their cardinality (e.g. InputText and InputTextMultiple) - they share a kind.
 */
export interface WidgetKind {
  key: string;
  label: string;
  /** The widget for a single value - undefined if the kind only shows lists of values */
  single?: string;
  /** The widget for a list of values - undefined if the kind only shows single values */
  multiple?: string;
  /**
   * What the property holds besides plain values - links make it a relation to instances of the target types,
   * embedded instances (of the target types) are part of the instance
   */
  holds?: "links" | "embedded";
}

export const WIDGET_KINDS: WidgetKind[] = [
  { key: "text", label: "Text", single: "InputText", multiple: "InputTextMultiple" },
  { key: "textarea", label: "Long text", single: "TextArea" },
  { key: "annotated", label: "Annotated text", single: "AnnotatedInputText" },
  { key: "number", label: "Number", single: "InputNumber", multiple: "InputNumberMultiple" },
  { key: "date", label: "Date", single: "InputDate" },
  { key: "datetime", label: "Date and time", single: "InputDateTime" },
  { key: "time", label: "Time", single: "InputTime" },
  { key: "color", label: "Color", single: "InputColor" },
  { key: "checkbox", label: "Checkbox", single: "CheckBox" },
  { key: "link", label: "Links (dropdown)", single: "SimpleDropdown", multiple: "DynamicDropdown", holds: "links" },
  { key: "linkTable", label: "Links (table)", multiple: "DynamicTable", holds: "links" },
  { key: "nested", label: "Embedded instances", single: "SingleNested", multiple: "Nested", holds: "embedded" },
];

/** The widgets the editor doesn't support yet - it shows their values as raw JSON. */
export const UNSUPPORTED_WIDGETS = ["InputTextMultiple", "InputNumberMultiple", "AnnotatedInputText"];

/** The kind and cardinality of the widget - undefined for widgets unknown to the modeler. */
export function widgetKind(widget: string | undefined): { kind: WidgetKind; cardinality: Cardinality } | undefined {
  for (const kind of WIDGET_KINDS) {
    if (widget && kind.single === widget) {
      return { kind, cardinality: "single" };
    }
    if (widget && kind.multiple === widget) {
      return { kind, cardinality: "multiple" };
    }
  }
  return undefined;
}

/** The widget of the kind for the cardinality - the one the kind has if it only supports one cardinality. */
export function widgetOf(kind: WidgetKind, cardinality: Cardinality): string {
  return (cardinality === "multiple" ? (kind.multiple ?? kind.single) : (kind.single ?? kind.multiple))!;
}

/** If the widget makes the property a relation - it links to instances of its target types. */
export function isRelationWidget(widget: string | undefined): boolean {
  return widgetKind(widget)?.kind.holds === "links";
}

/** A short description of the widget (e.g. "Text, multiple values"). */
export function describeWidget(widget: string | undefined): string {
  const known = widgetKind(widget);
  if (!known) {
    return widget ?? "No widget";
  }
  const { kind, cardinality } = known;
  return kind.single && kind.multiple ? `${kind.label}, ${cardinality === "single" ? "single value" : "multiple values"}` : kind.label;
}

/**
 * The properties numbered in the given order (starting at 1) - only the ones whose order number changes. Properties
 * without an order number are numbered as well, the order is kept as shown.
 */
export function orderChanges(properties: ModelProperty[]): { property: ModelProperty; orderNumber: number }[] {
  return properties
    .map((property, index) => ({ property, orderNumber: index + 1 }))
    .filter(({ property, orderNumber }) => property.orderNumber !== orderNumber);
}

/** The global functionalities required to modify the model. */
export const DEFINE_TYPES = "DEFINE_TYPES_AND_PROPERTIES";
export const DEFINE_VALIDATION_SCHEMAS = "DEFINE_VALIDATION_SCHEMAS";

/**
 * The modeler is only available to admins - the users who are allowed to modify the model (the core grants these
 * functionalities to admins only).
 */
export function modelerAvailable(functionalities: string[] | undefined): boolean {
  return !!functionalities?.some((f) => f === DEFINE_TYPES || f === DEFINE_VALIDATION_SCHEMAS);
}

const typeParam = (type: string) => `type=${encodeURIComponent(type)}`;

export function fetchModel(accessToken: string): Promise<ModelType[]> {
  return getJson("/api/modeler/types", "the types", accessToken);
}

/** The specification of the type - undefined if there is none (yet). */
export function fetchTypeSpecification(accessToken: string, type: string): Promise<TypeSpecification | undefined> {
  return send("GET", `/api/modeler/types/specification?${typeParam(type)}`, "load the specification", accessToken);
}

/** Creates or replaces the specification of the type - this is how new types are introduced. */
export function defineType(accessToken: string, type: string, specification: TypeSpecification): Promise<void> {
  return send("PUT", `/api/modeler/types/specification?${typeParam(type)}`, "save the type", accessToken, specification);
}

export function deleteTypeSpecification(accessToken: string, type: string): Promise<void> {
  return send("DELETE", `/api/modeler/types/specification?${typeParam(type)}`, "delete the type", accessToken);
}

/** How far a type is specified. */
export interface SpecificationStatus {
  /** If there is a specification for the type - otherwise it is only known from the data */
  specified: boolean;
  /** The number of properties without a specification (neither for the type nor globally) */
  unspecifiedProperties: number;
}

/** How far the types are specified (by the identifier of the type). */
export function fetchSpecificationStatus(accessToken: string): Promise<Record<string, SpecificationStatus>> {
  return getJson("/api/modeler/types/specificationStatus", "the specification status of the types", accessToken);
}

/**
 * Where the specification of a property comes from - specified for the type, only globally (for all types) or not at
 * all (only known from the data).
 */
export type SpecificationSource = "TYPE" | "GLOBAL" | "NONE";

/** Where the specifications of the properties of the type come from (by the identifier of the property). */
export function fetchPropertySources(accessToken: string, type: string): Promise<Record<string, SpecificationSource>> {
  return send("GET", `/api/modeler/types/properties/sources?${typeParam(type)}`, "load the property specifications", accessToken);
}

const propertyUrl = (type: string, property: string) =>
  `/api/modeler/types/properties?${typeParam(type)}&property=${encodeURIComponent(property)}`;

/** The definitions of a property - for a type and globally (for all types). */
export interface PropertyDefinitions {
  /** The specification for the type - its values not specified (null) are taken from the global one */
  type: PropertySpecification | null;
  /** The specification for all types */
  global: PropertySpecification | null;
}

/** Where a definition of a property applies - to the type only or to all types (globally). */
export type DefinitionScope = "type" | "global";

/** The definitions of the property - for the type and globally. */
export function fetchPropertyDefinitions(accessToken: string, type: string, property: string): Promise<PropertyDefinitions> {
  return send("GET", propertyUrl(type, property), "load the property", accessToken);
}

/** Creates or replaces the specification of the property for the type. */
export function defineProperty(
  accessToken: string,
  type: string,
  property: string,
  specification: PropertySpecification,
): Promise<void> {
  return send("PUT", propertyUrl(type, property), "save the property", accessToken, specification);
}

/** Creates or replaces the global specification of the property - it applies to all types. */
export function defineGlobalProperty(accessToken: string, property: string, specification: PropertySpecification): Promise<void> {
  return send("PUT", `/api/modeler/properties?property=${encodeURIComponent(property)}`, "save the property", accessToken, specification);
}

const SPECIFICATION_KEYS = [
  "name",
  "nameForReverseLink",
  "targetTypes",
  "widget",
  "readOnly",
  "labelTooltip",
  "required",
  "orderNumber",
] as const satisfies readonly (keyof PropertySpecification)[];

/** The values of the specification for the type - the ones it doesn't specify are taken from the global one. */
export function effectiveSpecification({ type, global }: PropertyDefinitions): PropertySpecification {
  const result: PropertySpecification = {};
  for (const key of SPECIFICATION_KEYS) {
    const value = key === "targetTypes" && !type?.targetTypes?.length ? undefined : type?.[key];
    (result as Record<string, unknown>)[key] = value ?? global?.[key] ?? undefined;
  }
  return result;
}

/** If the specification for the type defines more than the position of the property in the form of the type. */
export function hasTypeSpecificValues(definitions: PropertyDefinitions): boolean {
  return SPECIFICATION_KEYS.some((key) => key !== "orderNumber" && !sameValue(key, definitions.type?.[key], undefined));
}

/** If the values are the same - not specified, empty and false are the same. */
function sameValue(key: keyof PropertySpecification, a: unknown, b: unknown): boolean {
  if (key === "targetTypes") {
    const [x, y] = [(a as string[] | undefined) ?? [], (b as string[] | undefined) ?? []];
    return x.length === y.length && x.every((target) => y.includes(target));
  }
  const normalize = (value: unknown) => (value === "" || value === false || value === null ? undefined : value);
  return normalize(a) === normalize(b);
}

/** The values of the specification differing from the global one - the others are left to it (null). */
export function typeOverrides(values: PropertySpecification, global: PropertySpecification | null): PropertySpecification {
  const result: PropertySpecification = {};
  for (const key of SPECIFICATION_KEYS) {
    (result as Record<string, unknown>)[key] = sameValue(key, values[key], global?.[key]) ? null : values[key];
  }
  return result;
}

/**
 * Saves the values of a property - for the type only or for all types. For the type, only the values differing from
 * the global definition are stored (the others keep following it). For all types, the values are stored globally and
 * the type only keeps the position of the property in its form - its own values are dropped so the global ones apply.
 */
export async function savePropertyDefinition(
  accessToken: string,
  type: string,
  property: string,
  values: PropertySpecification,
  scope: DefinitionScope,
  definitions: PropertyDefinitions,
): Promise<void> {
  if (scope === "type") {
    await defineProperty(accessToken, type, property, { ...typeOverrides(values, definitions.global), orderNumber: values.orderNumber });
    return;
  }
  await defineGlobalProperty(accessToken, property, { ...values, orderNumber: definitions.global?.orderNumber });
  const orderNumber = definitions.type?.orderNumber ?? values.orderNumber;
  if (orderNumber !== undefined && orderNumber !== null) {
    await defineProperty(accessToken, type, property, { orderNumber });
  } else if (definitions.type) {
    await removeProperty(accessToken, type, property);
  }
}

/** Changes the order number of the property for the type - its other values are kept. */
export async function definePropertyOrder(
  accessToken: string,
  type: string,
  property: string,
  orderNumber: number,
): Promise<void> {
  const { type: specification } = await fetchPropertyDefinitions(accessToken, type, property);
  await defineProperty(accessToken, type, property, { ...specification, orderNumber });
}

export function removeProperty(accessToken: string, type: string, property: string): Promise<void> {
  return send("DELETE", propertyUrl(type, property), "remove the property", accessToken);
}

const schemaUrl = (type: string, name: string) =>
  `/api/modeler/types/validationSchemas/${encodeURIComponent(name)}?${typeParam(type)}`;

export function fetchValidationSchemas(accessToken: string, type: string): Promise<ValidationSchema[]> {
  return send("GET", `/api/modeler/types/validationSchemas?${typeParam(type)}`, "load the validation schemas", accessToken);
}

export function defineValidationSchema(
  accessToken: string,
  type: string,
  name: string,
  schema: Record<string, unknown>,
): Promise<void> {
  return send("PUT", schemaUrl(type, name), "save the validation schema", accessToken, schema);
}

export function deleteValidationSchema(accessToken: string, type: string, name: string): Promise<void> {
  return send("DELETE", schemaUrl(type, name), "delete the validation schema", accessToken);
}

/** The spaces the type is explicitly assigned to. */
export function fetchAssignedSpaces(accessToken: string, type: string): Promise<string[]> {
  return send("GET", `/api/modeler/types/spaces?${typeParam(type)}`, "load the spaces of the type", accessToken);
}

export function assignSpace(accessToken: string, type: string, space: string, assigned: boolean): Promise<void> {
  return send(
    assigned ? "PUT" : "DELETE",
    `/api/modeler/types/spaces/${encodeURIComponent(space)}?${typeParam(type)}`,
    assigned ? "assign the space" : "remove the space",
    accessToken,
  );
}

/** The last segment of an IRI (e.g. "Device" for "https://example.org/types/Device"). */
export function shortName(identifier: string): string {
  const segment = identifier.substring(Math.max(identifier.lastIndexOf("/"), identifier.lastIndexOf("#")) + 1);
  return segment || identifier;
}

export function typeName(type: Pick<ModelType, "identifier" | "name">): string {
  return type.name || shortName(type.identifier);
}

export function propertyName(property: Pick<ModelProperty, "identifier" | "name">): string {
  return property.name || shortName(property.identifier);
}

/** The relations between the types - one per property and target type. Targets not in the model are included. */
export function relations(types: ModelType[]): Relation[] {
  return types.flatMap((type) =>
    type.properties.flatMap((property) =>
      property.targetTypes.map((target) => ({
        source: type.identifier,
        target,
        property: property.identifier,
        label: propertyName(property),
      })),
    ),
  );
}

/** The relations pointing to the given type from other types (or itself). */
export function incomingRelations(types: ModelType[], type: string): Relation[] {
  return relations(types).filter((relation) => relation.target === type);
}

/**
 * Suggests a full name for a new type or property based on an existing one - e.g. "https://example.org/types/Room"
 * for "Room" and "https://example.org/types/Device". The name is used as is if it already is an IRI.
 */
export function suggestIdentifier(name: string, example?: string): string {
  const trimmed = name.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || !example) {
    return trimmed;
  }
  const namespace = example.substring(0, Math.max(example.lastIndexOf("/"), example.lastIndexOf("#")) + 1);
  return namespace + trimmed.replace(/\s+/g, "");
}
