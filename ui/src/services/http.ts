/** The requests currently in flight - identified by their url and the access token they are issued with. */
const pending = new Map<string, Promise<unknown>>();

/**
 * Fetches the JSON returned by the backend at the given url. Identical requests issued while one is still in flight
 * share its result instead of being sent again - e.g. when effects are run twice in a row (React strict mode) or several
 * components load the same data at once.
 *
 * @param what describes the loaded data in the error message (e.g. "the instances")
 */
export function getJson<T>(
  url: string,
  what: string,
  accessToken?: string,
): Promise<T> {
  const key = `${accessToken ?? ""} ${url}`;
  let request = pending.get(key) as Promise<T> | undefined;
  if (!request) {
    request = load<T>(url, what, accessToken).finally(() =>
      pending.delete(key),
    );
    pending.set(key, request);
  }
  return request;
}

async function load<T>(
  url: string,
  what: string,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to load ${what} (${response.status} ${response.statusText})`,
    );
  }
  return (await response.json()) as T;
}
