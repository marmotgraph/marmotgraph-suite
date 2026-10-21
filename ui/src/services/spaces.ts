export interface SpaceDefinition {
  identifier: string;
  name?: string;
}

/** Fetches the spaces known to the core. */
export async function fetchSpaces(
  accessToken: string,
): Promise<SpaceDefinition[]> {
  const response = await fetch("/api/spaces", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to load the spaces (${response.status} ${response.statusText})`,
    );
  }
  return (await response.json()) as SpaceDefinition[];
}
