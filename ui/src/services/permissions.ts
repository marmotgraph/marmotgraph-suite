import { getJson, send } from "./http";

export type Claims = Record<string, unknown>;

/** The claims a role is granted for - globally if no space is defined. */
export interface RoleDefinition {
  space?: string | null;
  role: string;
  claims: Claims;
}

/** Fetches the role definitions known to the core - sorted by space (global first) and role. */
export function fetchRoleDefinitions(accessToken: string): Promise<RoleDefinition[]> {
  return getJson("/api/admin/permissions", "the permissions", accessToken);
}

/** Fetches the roles claims can be mapped to (in the order of the core). */
export function fetchRoles(accessToken: string): Promise<string[]> {
  return getJson("/api/admin/permissions/roles", "the roles", accessToken);
}

/**
 * Adds the claim pattern to the role of the space (globally if there is no space) - or removes it if remove is set.
 * The remaining definition of the role is returned.
 */
export function updateRoleDefinition(
  accessToken: string,
  role: string,
  space: string | null | undefined,
  claim: Claims,
  remove: boolean,
): Promise<RoleDefinition> {
  const params = new URLSearchParams({ remove: String(remove) });
  if (space) {
    params.set("space", space);
  }
  return send(
    "PATCH",
    `/api/admin/permissions/${encodeURIComponent(role)}?${params}`,
    remove ? "remove the claim" : "add the claim",
    accessToken,
    claim,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Splits the claims of a role into individual claims - minimal patterns which can be removed one by one (the core
 * removes list entries and matching values of a pattern from the claims of the role). E.g.
 * {"roles": {"group": ["a", "b"]}} is split into {"roles": {"group": ["a"]}} and {"roles": {"group": ["b"]}}.
 */
export function individualClaims(claims: Claims): Claims[] {
  return Object.entries(claims).flatMap(([key, value]) => {
    if (isPlainObject(value) && Object.keys(value).length > 0) {
      return individualClaims(value).map((c) => ({ [key]: c }));
    }
    if (Array.isArray(value) && value.length > 0) {
      return value.map((v) => ({ [key]: [v] }));
    }
    return [{ [key]: value }];
  });
}
