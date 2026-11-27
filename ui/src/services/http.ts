/** A request answered with an error status - e.g. to tell a missing resource (404) apart from other failures */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Whether a resource requested by its id doesn't exist - 404, or 400 if the id isn't even valid (e.g. no UUID). Takes
 * the status of an {@link HttpError}.
 */
export function isNotFoundStatus(status: number | undefined): boolean {
  return status === 404 || status === 400;
}

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
    throw new HttpError(
      `Failed to load ${what} (${response.status} ${response.statusText})`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/**
 * Sends a modifying request (e.g. PUT, PATCH) to the backend - JSON bodies are serialized, text and form data are sent
 * as is. The returned JSON is provided (undefined if there is none). Errors are reported with the detail provided by
 * the backend if there is one (e.g. the reason why the core rejected the request).
 *
 * @param what describes the modification in the error message (e.g. "update the tenant")
 */
export async function send<T = void>(
  method: string,
  url: string,
  what: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  let payload: BodyInit | undefined;
  if (typeof body === "string") {
    headers["Content-Type"] = "text/plain";
    payload = body;
  } else if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(url, { method, headers, body: payload });
  const text = await response.text();
  const json = text ? safeParse(text) : undefined;
  if (!response.ok) {
    const detail = (json as { detail?: string } | undefined)?.detail;
    throw new HttpError(
      `Failed to ${what} (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }
  return json as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
