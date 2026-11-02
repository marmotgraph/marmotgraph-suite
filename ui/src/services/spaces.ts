import { getJson, send } from "./http";

export interface SpaceDefinition {
  identifier: string;
  name?: string;
}

/** Fetches the spaces known to the core. */
export function fetchSpaces(
  accessToken: string,
): Promise<SpaceDefinition[]> {
  return getJson("/api/spaces", "the spaces", accessToken);
}

/** The settings of a space which can be specified. */
export interface SpaceSettings {
  autoRelease: boolean;
  clientSpace: boolean;
  deferCache: boolean;
}

/** A space and its settings - which are not available if the user is not allowed to manage the space. */
export interface ManagedSpace {
  identifier: string;
  settings?: SpaceSettings | null;
  /** Whether the space has a specification - otherwise, it has the default settings. */
  specified: boolean;
}

/** Fetches the spaces which can be specified, along with the settings of those the user is allowed to manage. */
export function fetchManagedSpaces(accessToken: string): Promise<ManagedSpace[]> {
  return getJson("/api/admin/spaces", "the specifications of the spaces", accessToken);
}

/** Creates or replaces the specification of the space (creating the space if it doesn't exist yet). */
export function saveSpaceSpecification(accessToken: string, space: string, settings: SpaceSettings): Promise<void> {
  return send("PUT", `/api/admin/spaces/${encodeURIComponent(space)}`, "save the specification of the space", accessToken, settings);
}

/** Removes the specification of the space - the core removes the space too if there are no types in it. */
export function deleteSpaceSpecification(accessToken: string, space: string): Promise<void> {
  return send("DELETE", `/api/admin/spaces/${encodeURIComponent(space)}`, "delete the specification of the space", accessToken);
}
