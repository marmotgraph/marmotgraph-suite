import { getJson } from "./http";

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
