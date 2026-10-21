import { Instance } from "../modules/editor/editorMockData";

/** Fetches the instances shown in the editor - optionally restricted to those whose label matches the search term. */
export async function fetchInstances(
  accessToken: string,
  search?: string,
): Promise<Instance[]> {
  const query = search?.trim()
    ? `?${new URLSearchParams({ search: search.trim() })}`
    : "";
  const response = await fetch(`/api/instances${query}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to load the instances (${response.status} ${response.statusText})`,
    );
  }
  return (await response.json()) as Instance[];
}
