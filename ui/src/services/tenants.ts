import { getJson, send } from "./http";

export interface TenantDefinition {
  title?: string;
  contactEmail?: string;
  copyright?: string;
}

export interface Font {
  url?: string;
  fontFamily?: string;
}

/** The colors of a tenant - grouped as in the color scheme of the core (e.g. brandColors.primary). */
export type Colors = Record<string, Record<string, string | null>>;

export interface Theme {
  font: Font;
  colors: Colors;
  customCss: string;
}

export interface Tenant extends TenantDefinition {
  name: string;
  idNamespace?: string;
  theme: Theme;
  /** The resulting stylesheet of the tenant as provided by the core (generated from its theme) */
  css?: string;
  /** false for the default tenant which can not be modified */
  editable: boolean;
}

export type TenantImage = "logo" | "background" | "favicon";

/** The images which are defined for the dark and bright mode individually */
export const MODE_SPECIFIC_IMAGES: TenantImage[] = ["logo", "background"];

/** Tenant names are used as path segment - they are restricted to a safe set of characters (as by the backend). */
export const TENANT_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

const base = (name: string) => `/api/admin/tenants/${encodeURIComponent(name)}`;

export function fetchTenantNames(accessToken: string): Promise<string[]> {
  return getJson("/api/admin/tenants", "the tenants", accessToken);
}

/** Fetches the definition and theme of the tenant - the core falls back to its defaults for anything not defined. */
export function fetchTenant(accessToken: string, name: string): Promise<Tenant> {
  return getJson(base(name), `the tenant "${name}"`, accessToken);
}

/** Creates the tenant - or updates its definition if it already exists. */
export function defineTenant(accessToken: string, name: string, definition: TenantDefinition): Promise<void> {
  return send("PUT", base(name), "save the tenant", accessToken, definition);
}

export function setFont(accessToken: string, name: string, font: Font): Promise<void> {
  return send("PUT", `${base(name)}/theme/font`, "save the font", accessToken, font);
}

/** Replaces the color scheme - all colors of the scheme are required. */
export function setColors(accessToken: string, name: string, colors: Colors): Promise<void> {
  return send("PUT", `${base(name)}/theme/colors`, "save the colors", accessToken, colors);
}

export function setCustomCss(accessToken: string, name: string, css: string): Promise<void> {
  return send("PUT", `${base(name)}/theme/customCss`, "save the custom CSS", accessToken, css);
}

export function uploadImage(
  accessToken: string,
  name: string,
  image: TenantImage,
  file: File,
  darkMode: boolean,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  return send("PUT", `${base(name)}/theme/${image}?darkMode=${darkMode}`, `upload the ${image}`, accessToken, form);
}

/**
 * The url of an image of the tenant as provided (publicly) by the core - the version allows to bypass the cache of
 * the browser after an upload.
 */
export function imageUrl(coreUrl: string, name: string, image: TenantImage, darkMode: boolean, version: number): string {
  const params = new URLSearchParams({ v: String(version) });
  if (MODE_SPECIFIC_IMAGES.includes(image)) {
    params.set("darkMode", String(darkMode));
  }
  return `${coreUrl.replace(/\/+$/, "")}/v4/tenants/${encodeURIComponent(name)}/theme/${image}?${params}`;
}
