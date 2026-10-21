import { InstanceSummary, LinkedInstance } from "../modules/editor/editorMockData";
import { getJson } from "./http";

/** A single instance as shown in its detail view - to be extended with the properties of the instance. */
export interface InstanceDetail {
  instanceId: string;
  type: string;
  typeDescription?: string;
  typeColor?: string;
  instanceName: string;
  space: string;
  permissions: string;
  releaseStatus: "released" | "in progress";
  /** Not (yet) provided by the backend */
  directLinks?: LinkedInstance[];
  /** Not (yet) provided by the backend */
  reverseLinks?: LinkedInstance[];
}

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
