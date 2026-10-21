import { getJson } from "./http";

export interface AppConfig {
  authUrl: string;
  authTokenUrl: string;
  authClientId: string;
  /** The end session endpoint of the OIDC provider - absent if it doesn't support logging out */
  authLogoutUrl?: string;
  /** The base URL of the linked MarmotGraph core */
  coreUrl: string;
  commit?: string;
}

export async function fetchConfig(): Promise<AppConfig> {
  const config = await getJson<AppConfig>("/api/config", "the configuration");
  if (!config.authUrl || !config.authTokenUrl || !config.authClientId) {
    throw new Error("The configuration is missing authentication details");
  }
  return config;
}
