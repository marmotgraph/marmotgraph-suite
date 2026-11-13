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

/** A space the user is allowed to manage. */
export interface ManagedSpace {
  identifier: string;
  name?: string;
}

/** Fetches the spaces the user is allowed to manage (sorted by their identifier). */
export function fetchManagedSpaces(accessToken: string): Promise<ManagedSpace[]> {
  return getJson("/api/admin/spaces", "the spaces you manage", accessToken);
}

/** The specification of a space. */
export interface SpaceDetails {
  identifier: string;
  settings: SpaceSettings;
  /** Whether the space has a specification - otherwise, it has the default settings. */
  specified: boolean;
}

export function fetchSpaceDetails(accessToken: string, space: string): Promise<SpaceDetails> {
  return getJson(`/api/admin/spaces/${encodeURIComponent(space)}`, "the specification of the space", accessToken);
}

/** Creates or replaces the specification of the space (creating the space if it doesn't exist yet). */
export function saveSpaceSpecification(accessToken: string, space: string, settings: SpaceSettings): Promise<void> {
  return send("PUT", `/api/admin/spaces/${encodeURIComponent(space)}`, "save the specification of the space", accessToken, settings);
}

/** Removes the specification of the space - the core removes the space too if there are no types in it. */
export function deleteSpaceSpecification(accessToken: string, space: string): Promise<void> {
  return send("DELETE", `/api/admin/spaces/${encodeURIComponent(space)}`, "delete the specification of the space", accessToken);
}

/** A type with its relation to a space. */
export interface SpaceType {
  identifier: string;
  name?: string;
  color?: string;
  /** Whether the type is explicitly assigned to the space (e.g. to be offered when creating instances there). */
  assigned: boolean;
  /** The number of instances of the type in the space. */
  occurrences: number;
}

/** Fetches the types (sorted by name) along with their assignment to the space. */
export function fetchSpaceTypes(accessToken: string, space: string): Promise<SpaceType[]> {
  return getJson(`/api/admin/spaces/${encodeURIComponent(space)}/types`, "the types of the space", accessToken);
}

/** Assigns the type to the space - or removes it from the space if assigned is not set. */
export function assignType(accessToken: string, space: string, type: string, assigned: boolean): Promise<void> {
  return send(
    assigned ? "PUT" : "DELETE",
    `/api/admin/spaces/${encodeURIComponent(space)}/types?${new URLSearchParams({ type })}`,
    assigned ? "assign the type" : "remove the type",
    accessToken,
  );
}
