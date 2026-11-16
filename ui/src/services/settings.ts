import { getJson, send } from "./http";

/** The sections of the admin module whose settings can be exported - in the order of the navigation. */
export type SettingsSection = "spaces" | "permissions" | "tenants" | "tools";

export const SETTINGS_SECTIONS: SettingsSection[] = ["spaces", "permissions", "tenants", "tools"];

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  spaces: "Spaces",
  permissions: "Permissions",
  tenants: "Tenants",
  tools: "Tools",
};

/** The value identifying an exported settings file. */
export const SETTINGS_FORMAT = "marmotgraph-suite-settings";

/**
 * The exported settings - only the structure needed to summarize a file is typed, the content is handed back to the
 * backend as is. A section is missing if it wasn't exported.
 */
export interface SettingsDocument {
  format: string;
  version: number;
  exportedAt?: string;
  spaces?: unknown[];
  permissions?: unknown[];
  tenants?: unknown[];
  tools?: { categories?: unknown[]; definitions?: unknown[] };
}

/** The outcome of the import of a single setting - error is set if it couldn't be imported. */
export interface ImportResult {
  section: SettingsSection;
  item?: string | null;
  error?: string | null;
}

function sectionParams(sections: SettingsSection[]): string {
  const params = new URLSearchParams();
  sections.forEach((section) => params.append("sections", section));
  return params.toString();
}

/** Exports the settings of the given sections. */
export function exportSettings(accessToken: string, sections: SettingsSection[]): Promise<SettingsDocument> {
  return getJson(`/api/admin/settings/export?${sectionParams(sections)}`, "the settings", accessToken);
}

/** Imports the settings of the given sections of the document - it never removes anything. */
export function importSettings(accessToken: string, document: SettingsDocument, sections: SettingsSection[]): Promise<ImportResult[]> {
  return send("POST", `/api/admin/settings/import?${sectionParams(sections)}`, "import the settings", accessToken, document);
}

/**
 * Parses the content of a settings file - an error describes why it is not a settings export.
 */
export function parseSettings(content: string): SettingsDocument {
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  if (typeof document !== "object" || document === null || (document as SettingsDocument).format !== SETTINGS_FORMAT) {
    throw new Error("The file is not a MarmotGraph settings export.");
  }
  return document as SettingsDocument;
}

/** The number of settings of the section in the document - undefined if the section is not part of it. */
export function settingsCount(document: SettingsDocument, section: SettingsSection): number | undefined {
  if (section === "tools") {
    return document.tools ? (document.tools.categories?.length ?? 0) + (document.tools.definitions?.length ?? 0) : undefined;
  }
  return document[section]?.length;
}

/** The name of the file the settings are downloaded as - e.g. marmotgraph-settings-2026-11-14.json */
export function settingsFileName(date: Date = new Date()): string {
  return `marmotgraph-settings-${date.toISOString().slice(0, 10)}.json`;
}
