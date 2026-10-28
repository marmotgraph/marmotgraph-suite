import { InstanceSummary, InstanceValidation, LinkedInstance, ReleaseStatus } from "../modules/editor/editorMockData";
import { getJson, send } from "./http";

/** The kinds of fields as provided by the backend (translated from the widgets defined for the properties of the type). */
export type FieldKind =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "DATE"
  | "DATETIME"
  | "TIME"
  | "COLOR"
  | "CHECKBOX"
  | "LINK"
  | "LINKS"
  | "UNSUPPORTED";

/** A field of an instance - the value is in the shape required by its kind (e.g. LinkedInstance[] for LINKS). */
export interface InstanceField {
  identifier: string;
  label: string;
  kind: FieldKind;
  value?: unknown;
  required: boolean;
  readOnly: boolean;
  tooltip?: string;
  /** The types (identifiers) the field can link to */
  targetTypes?: string[];
}

/** A single instance as shown in its detail view. */
export interface InstanceDetail {
  instanceId: string;
  type: string;
  typeDescription?: string;
  typeColor?: string;
  instanceName: string;
  space: string;
  permissions: string;
  releaseStatus: ReleaseStatus;
  /** The fields in the order they are to be shown - not available for new instances (yet) */
  fields?: InstanceField[];
  /** The instances linked by the fields (labeled with the field they are linked by) */
  directLinks?: LinkedInstance[];
  /** The results of the last validation per validation schema of the type - with their errors */
  validation?: InstanceValidation[];
}

/** An instance linking to another one - its type is given by the group it is listed in. */
export type IncomingLink = Pick<
  LinkedInstance,
  | "instanceId"
  | "instanceName"
  | "space"
  | "linkStatus"
  | "hasDirectLinks"
  | "hasReverseLinks"
>;

/** The instances of a type linking to an instance - more of them can be loaded with the nextMarker if there is one. */
export interface IncomingLinksOfType {
  /** The identifier of the type */
  typeIdentifier: string;
  /** The name of the type */
  type: string;
  typeColor?: string;
  links: IncomingLink[];
  /** The number of instances of this type linking to the instance (if known) */
  total?: number;
  nextMarker?: string;
}

/** The instances linking to an instance by a property - grouped by their type. */
export interface IncomingLinks {
  property: string;
  /** Describes the property from the perspective of the linked instance (e.g. "Is language of") */
  label: string;
  types: IncomingLinksOfType[];
}

/** The number of incoming links loaded at once (per property and type). Same step as the outgoing list. */
export const INCOMING_LINKS_PAGE_SIZE = 5;

/** The attribute the instances are sorted by by the core - by name if not specified */
export type InstanceSortBy = "TYPE" | "NAME" | "LAST_MODIFICATION";
export type InstanceSortDirection = "ASC" | "DESC";

export interface InstanceQuery {
  /** Restricts the instances to those whose label matches the term */
  search?: string;
  /** Restricts the instances to those of any of the given types (identifiers) */
  types?: string[];
  /** Restricts the instances to those in any of the given spaces */
  spaces?: string[];
  /** Restricts the instances to the favorites of the user */
  favorites?: boolean;
  /** Restricts the instances to those the user has contributed to */
  contributed?: boolean;
  /** Restricts the instances to those with any of the given release statuses */
  releaseStatuses?: ReleaseStatus[];
  /** The attribute the instances are sorted by - by name if not specified */
  sortBy?: InstanceSortBy;
  /** The direction of the sorting - ascending if not specified */
  sortDirection?: InstanceSortDirection;
  /** The nextMarker of the previous page - the first page is loaded if not specified */
  marker?: string;
}

/** A page of the instances matching a query - with the total number of matching instances (if known). */
export interface InstanceList {
  instances: InstanceSummary[];
  total?: number;
  /** Loads the following page (see {@link InstanceQuery.marker}) - not provided if there are no more instances */
  nextMarker?: string;
}

/** Fetches the instances shown in the editor - the restrictions of the query are applied by the backend. */
export function fetchInstances(
  accessToken: string,
  { search, types = [], spaces = [], favorites = false, contributed = false, releaseStatuses = [], sortBy, sortDirection, marker }: InstanceQuery = {},
): Promise<InstanceList> {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  types.forEach((type) => params.append("type", type));
  spaces.forEach((space) => params.append("space", space));
  if (favorites) {
    params.set("favorites", "true");
  }
  if (contributed) {
    params.set("contributed", "true");
  }
  releaseStatuses.forEach((releaseStatus) => params.append("releaseStatus", releaseStatus));
  if (sortBy) {
    params.set("sortBy", sortBy);
  }
  if (sortDirection) {
    params.set("sortDirection", sortDirection);
  }
  if (marker) {
    params.set("marker", marker);
  }
  const query = params.toString() ? `?${params}` : "";
  return getJson(`/api/instances${query}`, "the instances", accessToken);
}

/** Fetches a single instance (by its uuid) for the detail view. */
export function fetchInstance(
  accessToken: string,
  instanceId: string,
): Promise<InstanceDetail> {
  return getJson(
    `/api/instances/${encodeURIComponent(instanceId)}`,
    "the instance",
    accessToken,
  );
}

/**
 * Updates the given fields of an instance (by their identifier, in the shape of their kind) - the other fields are kept
 * as they are. The instance as stored by the core is returned.
 */
export function updateInstance(
  accessToken: string,
  instanceId: string,
  changes: Record<string, unknown>,
): Promise<InstanceDetail> {
  return send(
    "PATCH",
    `/api/instances/${encodeURIComponent(instanceId)}`,
    "save the instance",
    accessToken,
    changes,
  );
}

/**
 * Creates an instance of the type with the given (client generated) id - the values of its fields by their identifier,
 * in the shape required by the kind of the field. It is created in the private space of the user if no space is given.
 */
export function createInstance(
  accessToken: string,
  instanceId: string,
  type: string,
  fields: Record<string, unknown>,
  space?: string,
): Promise<InstanceDetail> {
  return send(
    "POST",
    `/api/instances/${encodeURIComponent(instanceId)}`,
    "create the instance",
    accessToken,
    { type, space, fields },
  );
}

/** An instance as provided by the core - the full JSON-LD document. */
export type RawInstance = Record<string, unknown>;

/** Fetches the full JSON-LD document of an instance (by its uuid) for the raw view. */
export function fetchRawInstance(
  accessToken: string,
  instanceId: string,
): Promise<RawInstance> {
  return getJson(
    `/api/instances/${encodeURIComponent(instanceId)}/raw`,
    "the instance",
    accessToken,
  );
}

/** Replaces an instance by the given JSON-LD document - the instance as stored by the core is returned. */
export function replaceRawInstance(
  accessToken: string,
  instanceId: string,
  payload: RawInstance,
): Promise<RawInstance> {
  return send(
    "PUT",
    `/api/instances/${encodeURIComponent(instanceId)}/raw`,
    "save the instance",
    accessToken,
    payload,
  );
}

/**
 * Fetches the instances linking to the given one - grouped by property and type. If the marker of a group is given, only
 * the following page of this group is returned.
 */
export function fetchIncomingLinks(
  accessToken: string,
  instanceId: string,
  marker?: string,
): Promise<IncomingLinks[]> {
  const params = new URLSearchParams({
    size: String(INCOMING_LINKS_PAGE_SIZE),
  });
  if (marker) {
    params.set("marker", marker);
  }
  return getJson(
    `/api/instances/${encodeURIComponent(instanceId)}/incomingLinks?${params}`,
    "the incoming links",
    accessToken,
  );
}

/**
 * Adds the following page of a group (as returned for its marker) to the incoming links. The group is exhausted if the
 * page doesn't contain it (the core provides a next marker for full pages even if nothing follows).
 */
export function appendIncomingLinks(
  incomingLinks: IncomingLinks[],
  property: string,
  typeIdentifier: string,
  nextPage: IncomingLinks[],
): IncomingLinks[] {
  const page = nextPage
    .find((p) => p.property === property)
    ?.types.find((t) => t.typeIdentifier === typeIdentifier);
  return incomingLinks.map((group) =>
    group.property !== property
      ? group
      : {
          ...group,
          types: group.types.map((type) => {
            if (type.typeIdentifier !== typeIdentifier) {
              return type;
            }
            const known = new Set(type.links.map((l) => l.instanceId));
            return {
              ...type,
              links: [
                ...type.links,
                ...(page?.links ?? []).filter((l) => !known.has(l.instanceId)),
              ],
              total: page?.total ?? type.total,
              nextMarker: page?.links.length ? page.nextMarker : undefined,
            };
          }),
        },
  );
}

/**
 * An instance of the release tree of another one (the scope of its type evaluated for it) - with the instances reached
 * from it. The release status is the one of the instance itself (not of its children).
 */
export interface ReleaseNode {
  instanceId: string;
  instanceName: string;
  type: string;
  typeColor?: string;
  space?: string;
  releaseStatus: ReleaseStatus;
  /** Whether the user is allowed to release the instance */
  canRelease: boolean;
  /** Whether the user is allowed to unrelease the instance */
  canUnrelease: boolean;
  children: ReleaseNode[];
}

/** Fetches the release tree of an instance - with the release status and the permissions of the user per instance. */
export function fetchReleaseTree(
  accessToken: string,
  instanceId: string,
): Promise<ReleaseNode> {
  return getJson(
    `/api/instances/${encodeURIComponent(instanceId)}/scope`,
    "the release tree",
    accessToken,
  );
}

/** Releases the current state of an instance. */
export function releaseInstance(
  accessToken: string,
  instanceId: string,
): Promise<void> {
  return send(
    "PUT",
    `/api/instances/${encodeURIComponent(instanceId)}/release`,
    "release the instance",
    accessToken,
  );
}

/** Flags an instance as favorite of the user - or removes the flag. */
export function setFavorite(
  accessToken: string,
  instanceId: string,
  favorite: boolean,
): Promise<void> {
  return send(
    favorite ? "PUT" : "DELETE",
    `/api/instances/${encodeURIComponent(instanceId)}/favorite`,
    favorite ? "add the favorite" : "remove the favorite",
    accessToken,
  );
}

/** Removes the released version of an instance. */
export function unreleaseInstance(
  accessToken: string,
  instanceId: string,
): Promise<void> {
  return send(
    "DELETE",
    `/api/instances/${encodeURIComponent(instanceId)}/release`,
    "unrelease the instance",
    accessToken,
  );
}

/** A user who has contributed to an instance - the name falls back to the username. */
export interface Contributor {
  username: string;
  name: string;
}

/**
 * The administrative information of an instance - the timestamps (ISO-8601) are missing if unknown or if the instance
 * has never been released.
 */
export interface InstanceInformation {
  createdAt?: string;
  lastModified?: string;
  firstReleased?: string;
  lastReleased?: string;
  contributors: Contributor[];
}

/** Fetches the administrative information of an instance (timestamps and contributors). */
export function fetchInstanceInformation(
  accessToken: string,
  instanceId: string,
): Promise<InstanceInformation> {
  return getJson(
    `/api/instances/${encodeURIComponent(instanceId)}/info`,
    "the information of the instance",
    accessToken,
  );
}
