export interface TypeDefinition {
  identifier: string;
  name?: string;
  description?: string;
  color?: string;
  labelProperty?: string;
}

/** Fetches the types known to the core. */
export async function fetchTypes(
  accessToken: string,
): Promise<TypeDefinition[]> {
  const response = await fetch("/api/types", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to load the types (${response.status} ${response.statusText})`,
    );
  }
  return (await response.json()) as TypeDefinition[];
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
