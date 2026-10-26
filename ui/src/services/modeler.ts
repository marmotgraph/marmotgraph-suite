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

/** The widgets the core knows to show properties with. */
export const WIDGETS = [
  "InputText",
  "TextArea",
  "InputNumber",
  "InputDate",
  "InputDateTime",
  "InputTime",
  "InputColor",
  "CheckBox",
  "SimpleDropdown",
  "DynamicDropdown",
  "DynamicTable",
  "InputTextMultiple",
  "InputNumberMultiple",
  "AnnotatedInputText",
  "Nested",
  "SingleNested",
];

/** The widgets linking to other instances - suggested for relations. */
export const LINK_WIDGETS = ["DynamicDropdown", "DynamicTable", "SimpleDropdown"];

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

/** The specification of the property for the type - undefined if there is none (yet). */
export function fetchPropertySpecification(
  accessToken: string,
  type: string,
  property: string,
): Promise<PropertySpecification | undefined> {
  return send("GET", propertyUrl(type, property), "load the property", accessToken);
}

export function defineProperty(
  accessToken: string,
  type: string,
  property: string,
  specification: PropertySpecification,
): Promise<void> {
  return send("PUT", propertyUrl(type, property), "save the property", accessToken, specification);
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
