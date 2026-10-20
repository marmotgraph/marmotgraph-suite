export interface AppConfig {
  authUrl: string;
  authTokenUrl: string;
  authClientId: string;
  commit?: string;
}

export async function fetchConfig(): Promise<AppConfig> {
  const response = await fetch("/api/config", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to load the configuration (${response.status} ${response.statusText})`,
    );
  }
  const config = (await response.json()) as AppConfig;
  if (!config.authUrl || !config.authTokenUrl || !config.authClientId) {
    throw new Error("The configuration is missing authentication details");
  }
  return config;
}
