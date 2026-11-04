export type AdminSection = "permissions" | "tenants";

/** The global functionality each section of the admin module requires (in the order of the tabs). */
const REQUIRED_FUNCTIONALITY: Record<AdminSection, string> = {
  permissions: "CREATE_PERMISSION",
  tenants: "TENANT_MANAGEMENT",
};

/** The sections of the admin module available with the given global functionalities - the module is hidden if empty. */
export function adminSections(functionalities: string[] | undefined): AdminSection[] {
  return (Object.keys(REQUIRED_FUNCTIONALITY) as AdminSection[]).filter((section) =>
    functionalities?.includes(REQUIRED_FUNCTIONALITY[section]),
  );
}
