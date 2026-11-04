import type {
  QueryFilter,
  QueryPath,
  QueryProperty,
  QuerySpecification,
  QueryStructureItem,
  QueryType,
} from "../../services/queries";

/**
 * The query builder composes a query as a tree of fields: the root stands for the type the query starts from, every
 * other field follows a property (or an incoming link in reverse) from the types its parent reaches. The tree is
 * translated from / to the query specification the core runs and stores (plain keys - the property names are the
 * keys in the result as they are).
 */

/** Request parameters of a query run - they can't be used as names of filter parameters */
export const RESERVED_PARAMETERS = [
  "stage",
  "instanceId",
  "restrictToSpaces",
  "marker",
  "size",
  "returnTotalResults",
  "from",
];

/** The options of a field known to the core - others are dropped by it */
export const FIELD_OPTIONS = ["required", "sort", "ensureOrder", "singleValue", "filter"];
/** The options of a field which stay on a flattened field (the others belong to the field it is flattened to) */
const OPTIONS_OF_FLATTENED_FIELD = ["ensureOrder", "required", "singleValue"];

export type FilterOption = Partial<QueryFilter>;

export const FILTER_OPERATIONS = [
  { value: "IS_EMPTY", label: "Is empty" },
  { value: "CONTAINS", label: "Contains" },
  { value: "EQUALS", label: "Equals" },
  { value: "STARTS_WITH", label: "Starts with" },
  { value: "ENDS_WITH", label: "Ends with" },
  { value: "REGEX", label: "Regex" },
];

export const SINGLE_VALUE_STRATEGIES = ["FIRST", "CONCAT"];

/** What a field follows - the root "follows" its type. */
export interface FieldSchema {
  identifier: string;
  label?: string;
  reverse: boolean;
  /** The types reached by following the property - empty for an attribute */
  targetTypes: string[];
}

export interface QueryField {
  /** Identifies the field within the tree (not part of the specification) */
  key: string;
  schema: FieldSchema;
  /** The property is not known for the types of the parent (or the path is missing) */
  isUnknown: boolean;
  /** The field has no path in the specification */
  isInvalid: boolean;
  /** The name of the property in the result - the default name is used if empty */
  alias?: string;
  /** The values of the (only) child field are returned instead of nested objects */
  isFlattened: boolean;
  /** required, sort, ensureOrder, singleValue, filter */
  options: Record<string, unknown>;
  /** Only the targets of these types are followed - no restriction if undefined */
  typeFilter?: string[];
  children: QueryField[];
}

export interface QueryModel {
  rootType: string;
  root: QueryField;
  label: string;
  description: string;
}

export type TypesById = Map<string, QueryType>;

let nextKey = 0;
function newKey(): string {
  nextKey += 1;
  return `field-${nextKey}`;
}

/** The last segment of an identifier ("name" for "https://schema.org/name", "id" for "@id") */
export function simpleName(identifier: string): string {
  if (identifier.startsWith("@")) {
    return identifier.substring(1);
  }
  return identifier.substring(
    Math.max(identifier.lastIndexOf("/"), identifier.lastIndexOf("#")) + 1,
  );
}

export function propertyLabel(property: { identifier: string; label?: string }): string {
  return property.label || simpleName(property.identifier);
}

export function typeName(types: TypesById, identifier: string): string {
  return types.get(identifier)?.name || simpleName(identifier);
}

export function isLink(field: QueryField): boolean {
  return field.schema.targetTypes.length > 0;
}

function rootField(rootType: string, types: TypesById): QueryField {
  const type = types.get(rootType);
  return {
    key: newKey(),
    schema: {
      identifier: rootType,
      label: type?.name || simpleName(rootType),
      reverse: false,
      targetTypes: [rootType],
    },
    isUnknown: !type,
    isInvalid: false,
    isFlattened: false,
    options: {},
    children: [],
  };
}

export function newQuery(rootType: string, types: TypesById): QueryModel {
  return {
    rootType,
    root: rootField(rootType, types),
    label: "",
    description: "",
  };
}

/** A new field following the given property */
export function fieldFor(property: QueryProperty): QueryField {
  return {
    key: newKey(),
    schema: {
      identifier: property.identifier,
      label: property.label,
      reverse: property.reverse,
      targetTypes: [...property.targetTypes],
    },
    isUnknown: false,
    isInvalid: false,
    isFlattened: false,
    options: {},
    children: [],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Tree navigation and modification
// ---------------------------------------------------------------------------------------------------------------------

/** The fields from the root to the field with the given key - empty if there is no such field. */
export function pathTo(root: QueryField, key: string): QueryField[] {
  if (root.key === key) {
    return [root];
  }
  for (const child of root.children) {
    const path = pathTo(child, key);
    if (path.length) {
      return [root, ...path];
    }
  }
  return [];
}

export function findField(root: QueryField, key: string): QueryField | undefined {
  return pathTo(root, key).at(-1);
}

/** Replaces the field with the given key by the result of the update - the other fields are kept as they are. */
export function updateField(
  root: QueryField,
  key: string,
  update: (field: QueryField) => QueryField,
): QueryField {
  if (root.key === key) {
    return update(root);
  }
  let changed = false;
  const children = root.children.map((child) => {
    const updated = updateField(child, key, update);
    changed = changed || updated !== child;
    return updated;
  });
  return changed ? { ...root, children } : root;
}

function mapFields(root: QueryField, map: (field: QueryField) => QueryField): QueryField {
  const mapped = map(root);
  return { ...mapped, children: mapped.children.map((child) => mapFields(child, map)) };
}

/** Adds the field as last child of the parent - a flattened parent only takes a single child. */
export function addField(root: QueryField, parentKey: string, field: QueryField): QueryField {
  return updateField(root, parentKey, (parent) =>
    parent.isFlattened && parent.children.length >= 1
      ? parent
      : { ...parent, children: [...parent.children, field] },
  );
}

export function removeField(root: QueryField, key: string): QueryField {
  const parent = pathTo(root, key).at(-2);
  if (!parent) {
    return root;
  }
  return updateField(root, parent.key, (p) => {
    const children = p.children.filter((child) => child.key !== key);
    // A field without children can't be flattened
    return { ...p, children, isFlattened: children.length ? p.isFlattened : false };
  });
}

/** Moves the field one position up (-1) or down (+1) among its siblings. */
export function moveField(root: QueryField, key: string, direction: -1 | 1): QueryField {
  const parent = pathTo(root, key).at(-2);
  if (!parent) {
    return root;
  }
  const index = parent.children.findIndex((child) => child.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= parent.children.length) {
    return root;
  }
  return updateField(root, parent.key, (p) => {
    const children = [...p.children];
    [children[index], children[target]] = [children[target], children[index]];
    return { ...p, children };
  });
}

/** Sets an option of the field - only one field of a query can sort the result. */
export function setOption(root: QueryField, key: string, name: string, value: unknown): QueryField {
  const base =
    name === "sort" && value
      ? mapFields(root, (field) =>
          field.options.sort === undefined ? field : { ...field, options: withoutKey(field.options, "sort") },
        )
      : root;
  return updateField(base, key, (field) => ({
    ...field,
    options: value === undefined ? withoutKey(field.options, name) : { ...field.options, [name]: value },
  }));
}

function withoutKey(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const result = { ...record };
  delete result[key];
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Derived information
// ---------------------------------------------------------------------------------------------------------------------

/** The field follows a link but has no child field to return from the linked instances */
export function needsChildren(field: QueryField): boolean {
  return isLink(field) && field.children.length === 0;
}

/** The problem of the field to show - undefined if there is none */
export function fieldProblem(field: QueryField, isRoot: boolean): string | undefined {
  if (field.isInvalid) {
    return "The field has no path";
  }
  if (field.isUnknown && !isRoot) {
    return "This is not a known property of the type(s) of the parent field";
  }
  if (field.alias !== undefined && field.alias !== "" && !field.alias.trim()) {
    return "The name in the result must not be blank";
  }
  if (needsChildren(field)) {
    return isRoot ? "Add at least one field to the query" : "A link needs at least one child field";
  }
  return undefined;
}

/** The name the field gets in the result if no alias is given */
export function defaultAlias(field: QueryField): string {
  let current = field;
  while (current.isFlattened && current.children[0] && isLink(current.children[0])) {
    current = current.children[0];
  }
  return simpleName(current.schema.identifier) || current.schema.label || "";
}

/** The field and all its ancestors are either attributes or flattened links - required to sort by it */
export function isFlattenedToRoot(path: QueryField[]): boolean {
  return path.slice(1).every((field) => !isLink(field) || field.isFlattened);
}

/** The types the field can be restricted to - the known target types and the ones only found in the filter. */
export function typeFilterOptions(field: QueryField): { identifier: string; selected: boolean; isUnknown: boolean }[] {
  const selected = field.typeFilter ?? [];
  const known = field.schema.targetTypes.map((identifier) => ({
    identifier,
    selected: selected.includes(identifier),
    isUnknown: false,
  }));
  const unknown = selected
    .filter((identifier) => !field.schema.targetTypes.includes(identifier))
    .map((identifier) => ({ identifier, selected: true, isUnknown: true }));
  return [...known, ...unknown];
}

/** The types whose properties can be added to the field - none for a flattened field (it has its only child). */
export function lookupTypes(field: QueryField): string[] {
  if (field.isFlattened) {
    return [];
  }
  return field.typeFilter
    ? field.schema.targetTypes.filter((type) => field.typeFilter?.includes(type))
    : field.schema.targetTypes;
}

/** The names of the filter parameters of the query (to provide values for when running it) */
export function parameterNames(root: QueryField): string[] {
  const names = new Set<string>();
  const collect = (field: QueryField) => {
    const parameter = (field.options.filter as FilterOption | undefined)?.parameter?.trim();
    if (parameter && !RESERVED_PARAMETERS.includes(parameter)) {
      names.add(parameter);
    }
    field.children.forEach(collect);
  };
  collect(root);
  return Array.from(names).sort();
}

export function isQueryEmpty(model: QueryModel): boolean {
  return model.root.children.length === 0;
}

/** Counts the problems of the fields of the query */
export function countProblems(root: QueryField): number {
  const count = (field: QueryField, isRoot: boolean): number =>
    (fieldProblem(field, isRoot) ? 1 : 0) + field.children.reduce((sum, child) => sum + count(child, false), 0);
  return count(root, true);
}

// ---------------------------------------------------------------------------------------------------------------------
// Field tree -> specification
// ---------------------------------------------------------------------------------------------------------------------

function pathItem(field: QueryField): QueryPath {
  return {
    property: field.schema.identifier,
    ...(field.schema.reverse ? { reverse: true } : {}),
    ...(field.typeFilter?.length ? { typeFilter: [...field.typeFilter] } : {}),
  };
}

function camelCase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

function propertyName(field: QueryField): string {
  return (
    field.alias?.trim() ||
    simpleName(field.schema.identifier) ||
    camelCase(field.schema.label ?? "") ||
    field.key.replace("-", "")
  );
}

function addOptions(target: QueryStructureItem, options: Record<string, unknown>, exclude: string[] = []) {
  Object.entries(options).forEach(([name, value]) => {
    if (exclude.includes(name) || value === undefined || value === null) {
      return;
    }
    switch (name) {
      case "sort":
      case "ensureOrder":
      case "required":
        if (value) {
          target[name] = true;
        }
        break;
      case "singleValue":
        if (value) {
          target.singleValue = value as QueryStructureItem["singleValue"];
        }
        break;
      case "filter": {
        const filter = value as FilterOption;
        if (filter.op) {
          target.filter = {
            op: filter.op,
            ...(filter.parameter !== undefined && filter.parameter !== "" ? { parameter: filter.parameter } : {}),
            ...(filter.value !== undefined && filter.op !== "IS_EMPTY" ? { value: filter.value } : {}),
          };
        }
        break;
      }
    }
  });
}

function specificationField(field: QueryField): QueryStructureItem {
  const paths: QueryPath[] = [];
  let target = field;
  while (target.isFlattened && target.children[0]) {
    paths.push(pathItem(target));
    target = target.children[0];
  }
  paths.push(pathItem(target));
  const result: QueryStructureItem = { propertyName: propertyName(field), path: paths };
  if (target.children.length) {
    result.structure = target.children.map(specificationField);
  }
  addOptions(result, field.options);
  if (target !== field) {
    // The options of the field the value is taken from - except for the ones which apply to the flattened field
    addOptions(result, target.options, OPTIONS_OF_FLATTENED_FIELD);
  }
  return result;
}

/** The specification of the query (as stored and run by the core) */
export function toSpecification(model: QueryModel): QuerySpecification {
  const specification: QuerySpecification = {
    meta: {
      type: model.rootType,
      ...(model.label.trim() ? { name: model.label.trim() } : {}),
      ...(model.description.trim() ? { description: model.description.trim() } : {}),
    },
  };
  if (model.root.children.length) {
    specification.structure = model.root.children.map(specificationField);
  }
  return specification;
}

// ---------------------------------------------------------------------------------------------------------------------
// Specification -> field tree
// ---------------------------------------------------------------------------------------------------------------------

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** A path element - given as object or (accepted by the core as well) by its property only */
function parsePath(item: unknown): QueryPath | undefined {
  if (typeof item === "string") {
    return item ? { property: item } : undefined;
  }
  if (isRecord(item) && typeof item.property === "string" && item.property) {
    const typeFilter = asArray(item.typeFilter as unknown).filter((t): t is string => typeof t === "string" && !!t);
    return {
      property: item.property,
      ...(item.reverse === true ? { reverse: true } : {}),
      ...(typeFilter.length ? { typeFilter } : {}),
    };
  }
  return undefined;
}

/** Resolves the path against the types of the parent field */
function resolveSchema(
  types: TypesById,
  lookups: string[],
  identifier: string,
  reverse: boolean,
  isLeaf: boolean,
): { schema: FieldSchema; isUnknown: boolean } {
  let found: QueryProperty | undefined;
  const targetTypes = new Set<string>();
  lookups.forEach((typeId) => {
    const property = types
      .get(typeId)
      ?.properties.find(
        (p) => p.identifier === identifier && p.reverse === reverse && (isLeaf || p.targetTypes.length > 0),
      );
    if (property) {
      found = found ?? property;
      property.targetTypes.forEach((t) => targetTypes.add(t));
    }
  });
  const isKeyword = identifier === "@id";
  return {
    schema: {
      identifier,
      label: found?.label ?? (isKeyword ? identifier : undefined),
      reverse,
      targetTypes: Array.from(targetTypes),
    },
    isUnknown: !found && !isKeyword,
  };
}

/** The options of the field the core knows - it drops all others */
function fieldOptions(json: Record<string, unknown>, include: (name: string) => boolean): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  FIELD_OPTIONS.forEach((name) => {
    const value = json[name];
    if (include(name) && value !== undefined && value !== null && value !== false) {
      options[name] = value;
    }
  });
  return options;
}

function parseField(types: TypesById, parent: QueryField, json: Record<string, unknown>): QueryField {
  const rawPaths = asArray(json.path as unknown);
  const first = parsePath(rawPaths[0]);
  const isFlattened = rawPaths.length > 1;
  const isLeaf = isFlattened ? false : json.structure === undefined;
  const resolved = first
    ? resolveSchema(types, lookupTypes(parent), first.property, !!first.reverse, isLeaf)
    : { schema: { identifier: "", reverse: false, targetTypes: [] }, isUnknown: true };

  const field: QueryField = {
    key: newKey(),
    schema: resolved.schema,
    isUnknown: resolved.isUnknown,
    isInvalid: !first,
    isFlattened,
    options: fieldOptions(json, (name) => !isFlattened || OPTIONS_OF_FLATTENED_FIELD.includes(name)),
    typeFilter: first?.typeFilter,
    children: [],
  };

  // Without a property name, the core returns the value under the property of the last element of the path
  const name =
    typeof json.propertyName === "string" && json.propertyName
      ? json.propertyName
      : parsePath(rawPaths.at(-1))?.property;
  if (name && name !== simpleName(field.schema.identifier)) {
    field.alias = name;
  }

  if (isFlattened) {
    // The rest of the path becomes the only child - with the options which don't apply to the flattened field
    const child: Record<string, unknown> = {
      ...fieldOptions(json, (option) => !OPTIONS_OF_FLATTENED_FIELD.includes(option)),
      path: rawPaths.slice(1),
    };
    if (json.structure !== undefined) {
      child.structure = json.structure;
    }
    field.children = [parseField(types, field, child)];
  } else {
    field.children = asArray(json.structure as unknown)
      .filter(isRecord)
      .map((child) => parseField(types, field, child));
  }
  return field;
}

/**
 * The query described by the specification - properties which are not known for the types are kept (flagged as
 * unknown) so nothing of the specification is lost.
 */
export function fromSpecification(specification: QuerySpecification, types: TypesById): QueryModel {
  const meta: Record<string, unknown> = isRecord(specification.meta) ? specification.meta : {};
  const rootType = typeof meta.type === "string" ? meta.type : "";
  const root = rootField(rootType, types);
  root.children = asArray(specification.structure as unknown)
    .filter(isRecord)
    .map((json) => parseField(types, root, json));
  return {
    rootType,
    root,
    label: typeof meta.name === "string" ? meta.name : "",
    description: typeof meta.description === "string" ? meta.description : "",
  };
}

/** The specification as text - used to tell whether the query has changed since it was loaded or stored */
export function specificationText(model: QueryModel): string {
  return JSON.stringify(toSpecification(model), null, 2);
}
