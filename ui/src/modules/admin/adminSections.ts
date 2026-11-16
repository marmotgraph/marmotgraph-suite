import { canManagePermissions } from "./RoleClaims";
import { MANAGE_SPACE } from "../../hooks/useManagedSpaces";

export type AdminSection = "permissions" | "tenants" | "tools" | "import-export";

/** If the section of the admin module is available with the given global functionalities (in the order of the navigation). */
const AVAILABLE: Record<AdminSection, (functionalities: string[]) => boolean> = {
  permissions: canManagePermissions,
  tenants: (f) => f.includes("TENANT_MANAGEMENT"),
  tools: (f) => f.includes("DEFINE_TOOLS"),
  // The settings of any of the sections (or of the spaces) can be exported
  "import-export": (f) => canManagePermissions(f) || ["TENANT_MANAGEMENT", "DEFINE_TOOLS", MANAGE_SPACE].some((x) => f.includes(x)),
};

/** The labels of the sections - in the navigation and as their title. */
export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  permissions: "Permissions",
  tenants: "Tenants",
  tools: "Tools",
  "import-export": "Import/export",
};

/** The sections of the admin module available with the given global functionalities - the module is hidden if empty. */
export function adminSections(functionalities: string[] | undefined): AdminSection[] {
  return (Object.keys(AVAILABLE) as AdminSection[]).filter((section) => !!functionalities && AVAILABLE[section](functionalities));
}
