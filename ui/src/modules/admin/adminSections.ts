import { canManagePermissions } from "./RoleClaims";

export type AdminSection = "permissions" | "tenants" | "tools";

/** If the section of the admin module is available with the given global functionalities (in the order of the navigation). */
const AVAILABLE: Record<AdminSection, (functionalities: string[]) => boolean> = {
  permissions: canManagePermissions,
  tenants: (f) => f.includes("TENANT_MANAGEMENT"),
  tools: (f) => f.includes("DEFINE_TOOLS"),
};

/** The labels of the sections - in the navigation and as their title. */
export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  permissions: "Permissions",
  tenants: "Tenants",
  tools: "Tools",
};

/** The sections of the admin module available with the given global functionalities - the module is hidden if empty. */
export function adminSections(functionalities: string[] | undefined): AdminSection[] {
  return (Object.keys(AVAILABLE) as AdminSection[]).filter((section) => !!functionalities && AVAILABLE[section](functionalities));
}
