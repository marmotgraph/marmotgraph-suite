import { getJson, send } from "./http";

/** A hop along a property ("@id" for the id of the instance) - backwards (an incoming link) if reverse is true. */
export interface QueryPath {
  property: string;
  reverse?: boolean;
  /** Only the instances of one of these types are reached */
  typeFilter?: string[];
}

export type QueryFilterOperation = "IS_EMPTY" | "STARTS_WITH" | "ENDS_WITH" | "CONTAINS" | "EQUALS" | "REGEX";

/** Filters the values by a fixed value or - taking precedence - by the request parameter with the given name. */
export interface QueryFilter {
  op: QueryFilterOperation;
  parameter?: string;
  value?: string;
}

/** A value of the results: the path to follow and - for links and embedded objects - the nested structure. */
export interface QueryStructureItem {
  /** The key in the results - the property of the last element of the path if not given */
  propertyName?: string;
  path: QueryPath[];
  structure?: QueryStructureItem[];
  required?: boolean;
  sort?: boolean;
  /** The reached instances are returned in the order of the links in the payload (and with duplicates) */
  ensureOrder?: boolean;
  filter?: QueryFilter;
  singleValue?: "FIRST" | "CONCAT";
}

/** A query (plain keys, no JSON-LD): the type it starts from and the structure of its results. */
export interface QuerySpecification {
  meta: { type: string; name?: string; description?: string };
  structure?: QueryStructureItem[];
}

/** A stored query as listed (without its structure) */
export interface QuerySummary {
  id: string;
  label?: string;
  description?: string;
  /** The type the query starts from */
  type?: string;
  space?: string;
}

/** A stored query with its specification */
export interface QueryDocument {
  id: string;
  /** "myspace" for the private space of the user */
  space?: string;
  specification: QuerySpecification;
}

/** A space queries can be stored in - with what the user is allowed to do with the queries in it. */
export interface QuerySpace {
  identifier: string;
  name?: string;
  isPrivate: boolean;
  canCreate: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

/** A property a query can follow - an incoming link is followed in reverse. */
export interface QueryProperty {
  identifier: string;
  label?: string;
  reverse: boolean;
  /** The types the property links to (the source types for an incoming link) - empty for an attribute */
  targetTypes: string[];
}

/** A type a query can start from or reach - with the properties to follow from it. */
export interface QueryType {
  identifier: string;
  name?: string;
  description?: string;
  color?: string;
  properties: QueryProperty[];
}

export type QueryStage = "RELEASED" | "IN_PROGRESS";

export interface QueryRunParameters {
  stage: QueryStage;
  size: number;
  /** The "nextMarker" of the previous page to continue from */
  marker?: string;
  instanceId?: string;
  /** Only the instances in these spaces are returned - all readable ones if undefined */
  restrictToSpaces?: string[];
  /** The values of the parametrized filters of the query */
  filterValues: Record<string, string>;
}

export interface QueryResult {
  data: Record<string, unknown>[];
  total?: number;
  size?: number;
  nextMarker?: string;
  durationInMs?: number;
}

/** Lists the stored queries the user can read - optionally only the ones starting from the given type. */
export function fetchQueries(
  accessToken: string,
  type?: string,
): Promise<QuerySummary[]> {
  const params = type ? `?type=${encodeURIComponent(type)}` : "";
  return getJson(`/api/queries${params}`, "the queries", accessToken);
}

export function fetchQuery(
  accessToken: string,
  queryId: string,
): Promise<QueryDocument> {
  return getJson(
    `/api/queries/${encodeURIComponent(queryId)}`,
    "the query",
    accessToken,
  );
}

/** The spaces with the permissions of the user in them - the private space first. */
export function fetchQuerySpaces(accessToken: string): Promise<QuerySpace[]> {
  return getJson("/api/queries/spaces", "the spaces", accessToken);
}

/** The types with the properties and incoming links a query can follow from them. */
export function fetchQueryTypes(accessToken: string): Promise<QueryType[]> {
  return getJson("/api/queries/types", "the types", accessToken);
}

/** Stores the query - the space is only applied if the query is created. */
export function saveQuery(
  accessToken: string,
  queryId: string,
  specification: QuerySpecification,
  space?: string,
): Promise<QueryDocument> {
  const params = space ? `?space=${encodeURIComponent(space)}` : "";
  return send(
    "PUT",
    `/api/queries/${encodeURIComponent(queryId)}${params}`,
    "save the query",
    accessToken,
    specification,
  );
}

export function deleteQuery(
  accessToken: string,
  queryId: string,
): Promise<void> {
  return send(
    "DELETE",
    `/api/queries/${encodeURIComponent(queryId)}`,
    "delete the query",
    accessToken,
  );
}

/** Runs the query as given (without storing it). */
export function runQuery(
  accessToken: string,
  specification: QuerySpecification,
  parameters: QueryRunParameters,
): Promise<QueryResult> {
  const params = new URLSearchParams();
  params.set("stage", parameters.stage);
  params.set("size", String(parameters.size));
  if (parameters.marker) {
    params.set("marker", parameters.marker);
  }
  if (parameters.instanceId) {
    params.set("instanceId", parameters.instanceId);
  }
  parameters.restrictToSpaces?.forEach((space) =>
    params.append("restrictToSpaces", space),
  );
  Object.entries(parameters.filterValues).forEach(([name, value]) => {
    if (value) {
      params.set(name, value);
    }
  });
  return send(
    "POST",
    `/api/queries/run?${params.toString()}`,
    "run the query",
    accessToken,
    specification,
  );
}
