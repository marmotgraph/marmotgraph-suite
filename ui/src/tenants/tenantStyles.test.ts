import { applyTenantUiStyle, TENANT_ATTRIBUTE } from "./tenantStyles";

describe("applyTenantUiStyle", () => {
  const attribute = () => document.documentElement.getAttribute(TENANT_ATTRIBUTE);

  afterEach(() => {
    document.documentElement.removeAttribute(TENANT_ATTRIBUTE);
  });

  it("keeps the default style for a tenant without a style", async () => {
    const load = vi.fn().mockResolvedValue({});

    await applyTenantUiStyle("acme", new Map([["cscs", load]]));

    expect(load).not.toHaveBeenCalled();
    expect(attribute()).toBeNull();
  });

  it("keeps the default style if no tenant is known", async () => {
    await applyTenantUiStyle(undefined, new Map());

    expect(attribute()).toBeNull();
  });

  it("loads the style of a tenant regardless of the case of its name", async () => {
    const load = vi.fn().mockResolvedValue({});

    await applyTenantUiStyle("CSCS", new Map([["cscs", load]]));

    expect(load).toHaveBeenCalledOnce();
    expect(attribute()).toBe("cscs");
  });

  it("only marks the tenant once its style is loaded", async () => {
    let finish: () => void = () => {};
    const load = () => new Promise<void>((resolve) => (finish = resolve));

    const applied = applyTenantUiStyle("cscs", new Map([["cscs", load]]));
    expect(attribute()).toBeNull();
    finish();
    await applied;

    expect(attribute()).toBe("cscs");
  });

  it("falls back to the default style if the style can't be loaded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      applyTenantUiStyle("cscs", new Map([["cscs", () => Promise.reject(new Error("offline"))]])),
    ).resolves.toBeUndefined();

    expect(attribute()).toBeNull();
    warn.mockRestore();
  });

  it("drops the style of a previous tenant", async () => {
    document.documentElement.setAttribute(TENANT_ATTRIBUTE, "cscs");

    await applyTenantUiStyle("acme", new Map());

    expect(attribute()).toBeNull();
  });
});
