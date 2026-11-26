export interface AppConfig {
  authUrl: string;
  authTokenUrl: string;
  authClientId: string;
  /** The end session endpoint of the OIDC provider - absent if it doesn't support logging out */
  authLogoutUrl?: string;
  /** The base URL of the linked MarmotGraph core */
  coreUrl: string;
  /** The tenant of the core whose customizations (e.g. the logo) are applied to the UI */
  tenant: string;
  commit?: string;
}

/** Fallback if the response doesn't say when to try again */
const DEFAULT_RETRY_INTERVAL_S = 10;
/** The tenant of the last loaded configuration - to show an outage of the suite backend in the style of the tenant */
const TENANT_STORAGE_KEY = "marmotgraph.tenant";

/** Which service the suite can't reach - "core" is the MarmotGraph core behind the backend, "suite" the backend itself */
export type UnavailableService = "core" | "suite";

/** A service the suite depends on can't be reached - nothing depending on it (e.g. the login) can be offered meanwhile. */
export class ServiceUnavailableError extends Error {
  constructor(
    readonly service: UnavailableService,
    message: string,
    /** When to try again (in seconds) */
    readonly retryInterval: number,
    /** The tenant of the deployment - to show the outage in its style */
    readonly tenant?: string,
  ) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

interface Problem {
  detail?: string;
  retryInterval?: number;
  tenant?: string;
}

function retryAfter(response: Response): number {
  const seconds = Number(response.headers.get("Retry-After"));
  return seconds > 0 ? seconds : DEFAULT_RETRY_INTERVAL_S;
}

function lastKnownTenant(): string | undefined {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberTenant(tenant: string | undefined) {
  try {
    if (tenant) {
      localStorage.setItem(TENANT_STORAGE_KEY, tenant);
    }
  } catch {
    // Without storage, an outage of the backend is just shown in the default style
  }
}

function suiteUnavailable(reason: string, retryInterval = DEFAULT_RETRY_INTERVAL_S) {
  return new ServiceUnavailableError("suite", `The suite backend is not reachable: ${reason}`, retryInterval, lastKnownTenant());
}

/**
 * @throws ServiceUnavailableError if the suite backend can't be reached (the request fails or is answered by a proxy
 * in its place, e.g. with 502) or if it reports the MarmotGraph core as unreachable (503 with a retry interval)
 */
export async function fetchConfig(): Promise<AppConfig> {
  let response: Response;
  try {
    response = await fetch("/api/config", { headers: { Accept: "application/json" }, cache: "no-store" });
  } catch (e) {
    throw suiteUnavailable(e instanceof Error ? e.message : String(e));
  }
  if (response.status >= 500) {
    // The backend answers with JSON (a problem detail) - anything else comes from a proxy in front of it
    const fromBackend = response.headers.get("Content-Type")?.includes("json") ?? false;
    const problem = fromBackend ? ((await response.json().catch(() => ({}))) as Problem) : undefined;
    if (problem?.retryInterval !== undefined) {
      rememberTenant(problem.tenant);
      throw new ServiceUnavailableError(
        "core",
        problem.detail ?? "The MarmotGraph core is not reachable",
        problem.retryInterval,
        problem.tenant ?? lastKnownTenant(),
      );
    }
    if (!fromBackend) {
      throw suiteUnavailable(`${response.status} ${response.statusText}`.trim(), retryAfter(response));
    }
    throw new Error(`Failed to load the configuration (${response.status} ${response.statusText})${problem?.detail ? `: ${problem.detail}` : ""}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to load the configuration (${response.status} ${response.statusText})`);
  }
  const config = (await response.json()) as AppConfig;
  if (!config.authUrl || !config.authTokenUrl || !config.authClientId) {
    throw new Error("The configuration is missing authentication details");
  }
  rememberTenant(config.tenant);
  return config;
}
