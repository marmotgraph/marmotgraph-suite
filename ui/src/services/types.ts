import { getJson } from "./http";
import { InstanceField } from "./instances";

export interface TypeDefinition {
  identifier: string;
  name?: string;
  description?: string;
  color?: string;
  labelProperty?: string;
}

/** Fetches the types known to the core. */
export function fetchTypes(
  accessToken: string,
): Promise<TypeDefinition[]> {
  return getJson("/api/types", "the types", accessToken);
}

/** Fetches the fields of a type (in the order they are to be shown) - all empty, as for a new instance of it. */
export function fetchTypeFields(
  accessToken: string,
  typeIdentifier: string,
): Promise<InstanceField[]> {
  return getJson(
    `/api/types/fields?type=${encodeURIComponent(typeIdentifier)}`,
    "the fields of the type",
    accessToken,
  );
}

/** The name to show for the type - falls back to the last segment of its identifier (as the instances do). */
export function typeLabel(type: TypeDefinition): string {
  return (
    type.name ||
    type.identifier.substring(
      Math.max(
        type.identifier.lastIndexOf("/"),
        type.identifier.lastIndexOf("#"),
      ) + 1,
    )
  );
}
