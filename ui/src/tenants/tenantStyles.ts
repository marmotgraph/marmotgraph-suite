/**
 * Tenant specific styles of the UI (as opposed to the theme which the core generates for a tenant, see services/tenants).
 *
 * The default style of the UI is always the one in the regular stylesheets. A tenant only gets a different look if it
 * is registered here. The stylesheet of such a tenant is
 *  - a separate file in tenants/<tenant>/ - it is loaded on demand, other tenants never download it
 *  - scoped to html[data-tenant="<tenant>"] - without the attribute it has no effect
 */

/** The attribute of the root element which identifies the tenant whose style is applied */
export const TENANT_ATTRIBUTE = "data-tenant";

type StyleLoader = () => Promise<unknown>;

/** Registered tenants - keyed by their lower case name. Add the stylesheet of a new tenant here. */
const TENANT_STYLES: ReadonlyMap<string, StyleLoader> = new Map([["cscs", () => import("./cscs/cscs.css")]]);

/**
 * Applies the style of the tenant if it has one - the default style remains otherwise (or if the style can't be
 * loaded). Resolves once the style is loaded so the UI isn't shown in the default style first. Never rejects.
 */
export async function applyTenantUiStyle(
  tenant: string | undefined,
  styles: ReadonlyMap<string, StyleLoader> = TENANT_STYLES,
): Promise<void> {
  const root = document.documentElement;
  const key = tenant?.trim().toLowerCase() ?? "";
  const load = styles.get(key);
  if (!load) {
    root.removeAttribute(TENANT_ATTRIBUTE);
    return;
  }
  try {
    await load();
    root.setAttribute(TENANT_ATTRIBUTE, key);
  } catch (e) {
    console.warn(`The style of the tenant "${tenant}" could not be loaded - using the default style`, e);
    root.removeAttribute(TENANT_ATTRIBUTE);
  }
}
