import { Instance } from "../modules/editor/editorMockData";

/** Fetches the instances shown in the editor. */
export async function fetchInstances(accessToken: string): Promise<Instance[]> {
  const response = await fetch("/api/instances", {
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
