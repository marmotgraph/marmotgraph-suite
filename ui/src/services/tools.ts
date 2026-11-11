import { getJson, send } from "./http";
import { Claims } from "./permissions";

/** A tool built on top of the graph (e.g. a search or a dashboard) - it runs on its own at its endpoint. */
export interface Tool {
  id: string;
  name: string;
  description?: string | null;
  category: { id: string; name: string };
  /** The absolute http(s) URL of the tool */
  endpoint: string;
}

/** A category of tools - with its SVG icon (markup) if it has one. */
export interface ToolCategory {
  id: string;
  name: string;
  icon?: string | null;
}

/** A category with the tools of the user listed in it. */
export interface CategoryWithTools extends ToolCategory {
  tools: Tool[];
}

/** The full definition of a tool - including the claims a user has to match to get it listed. */
export interface ToolDefinition extends Tool {
  claims: Claims;
}

export interface ToolSpecification {
  name: string;
  description?: string;
  categoryId: string;
  endpoint: string;
  claims: Claims;
}

/** The claims listing a tool to every authenticated user */
export const EVERY_AUTHENTICATED_USER: Claims = { authenticated: true };

/** The categories (sorted by name) with the tools available to the user - categories without tools are left out. */
export function fetchTools(accessToken: string): Promise<CategoryWithTools[]> {
  return getJson("/api/tools", "the tools", accessToken);
}

/**
 * The icon of a category as image source - the markup is shown as image (never inlined into the page), so nothing in
 * it can act on the page even though the core only accepts passive icons.
 */
export function iconSource(icon: string | null | undefined): string | undefined {
  return icon?.trim() ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon)}` : undefined;
}

const admin = "/api/admin/tools";

/** All categories - including the ones without tools. */
export function fetchToolCategories(accessToken: string): Promise<ToolCategory[]> {
  return getJson(`${admin}/categories`, "the tool categories", accessToken);
}

/** Creates the category - or replaces its name and icon if an id is given. */
export function saveToolCategory(accessToken: string, category: { id?: string; name: string; icon?: string }): Promise<ToolCategory> {
  const body = { name: category.name, icon: category.icon };
  return category.id
    ? send("PUT", `${admin}/categories/${encodeURIComponent(category.id)}`, "save the category", accessToken, body)
    : send("POST", `${admin}/categories`, "create the category", accessToken, body);
}

/** Removes the category - the core rejects it as long as it has tools. */
export function deleteToolCategory(accessToken: string, id: string): Promise<void> {
  return send("DELETE", `${admin}/categories/${encodeURIComponent(id)}`, "delete the category", accessToken);
}

export function fetchToolDefinitions(accessToken: string): Promise<ToolDefinition[]> {
  return getJson(`${admin}/definitions`, "the tools", accessToken);
}

/** Creates the tool - or replaces its definition if an id is given. */
export function saveTool(accessToken: string, specification: ToolSpecification, id?: string): Promise<ToolDefinition> {
  return id
    ? send("PUT", `${admin}/definitions/${encodeURIComponent(id)}`, "save the tool", accessToken, specification)
    : send("POST", `${admin}/definitions`, "create the tool", accessToken, specification);
}

export function deleteTool(accessToken: string, id: string): Promise<void> {
  return send("DELETE", `${admin}/definitions/${encodeURIComponent(id)}`, "delete the tool", accessToken);
}
