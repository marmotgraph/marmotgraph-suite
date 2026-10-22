import { InstanceSummary, LinkedInstance } from "../modules/editor/editorMockData";
import { getJson } from "./http";

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
  releaseStatus: "released" | "in progress";
  /** The fields in the order they are to be shown - not available for new instances (yet) */
  fields?: InstanceField[];
  /** The instances linked by the fields (labeled with the field they are linked by) */
  directLinks?: LinkedInstance[];
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

/** The number of incoming links loaded at once (per property and type) */
export const INCOMING_LINKS_PAGE_SIZE = 2;

export interface InstanceQuery {
  /** Restricts the instances to those whose label matches the term */
  search?: string;
  /** Restricts the instances to those of any of the given types (identifiers) */
  types?: string[];
  /** Restricts the instances to those in any of the given spaces */
  spaces?: string[];
}

/** Fetches the instances shown in the editor - the restrictions of the query are applied by the backend. */
export function fetchInstances(
  accessToken: string,
  { search, types = [], spaces = [] }: InstanceQuery = {},
): Promise<InstanceSummary[]> {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  types.forEach((type) => params.append("type", type));
  spaces.forEach((space) => params.append("space", space));
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
