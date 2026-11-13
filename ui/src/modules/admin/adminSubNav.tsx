import { ADMIN_SECTION_LABELS, AdminSection } from "./adminSections";

/** The subnav of the admin module - titled by the current section. */
export function adminSubNav(pathname: string) {
  const section = pathname.split("/")[2] as AdminSection | undefined;
  return {
    title: (section && ADMIN_SECTION_LABELS[section]) || "Admin",
    ctas: [],
  };
}
