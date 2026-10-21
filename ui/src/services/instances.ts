import { Instance } from "../modules/editor/editorMockData";

export interface InstanceQuery {
  /** Restricts the instances to those whose label matches the term */
  search?: string;
  /** Restricts the instances to those of any of the given types (identifiers) */
  types?: string[];
  /** Restricts the instances to those in any of the given spaces */
  spaces?: string[];
}

/** Fetches the instances shown in the editor - the restrictions of the query are applied by the backend. */
export async function fetchInstances(
  accessToken: string,
  { search, types = [], spaces = [] }: InstanceQuery = {},
): Promise<Instance[]> {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  types.forEach((type) => params.append("type", type));
  spaces.forEach((space) => params.append("space", space));
  const query = params.toString() ? `?${params}` : "";
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
