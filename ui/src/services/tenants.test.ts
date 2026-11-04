import { applyTenantStylesheet, imageUrl, stylesheetUrl } from "./tenants";

describe("stylesheetUrl", () => {
  it("points to the stylesheet of the tenant in the core", () => {
    expect(stylesheetUrl("https://core.example.org/", "my tenant")).toBe(
      "https://core.example.org/v4/tenants/my%20tenant/theme/css",
    );
  });
});

describe("imageUrl", () => {
  it("points to the image of the tenant in the core", () => {
    expect(imageUrl("https://core.example.org/", "acme", "logo", true, 2)).toBe(
      "https://core.example.org/v4/tenants/acme/theme/logo?v=2&darkMode=true",
    );
    expect(imageUrl("https://core.example.org", "acme", "favicon", true)).toBe(
      "https://core.example.org/v4/tenants/acme/theme/favicon",
    );
  });
});

describe("applyTenantStylesheet", () => {
  const stylesheets = () => document.head.querySelectorAll<HTMLLinkElement>("link#tenant-stylesheet");

  afterEach(() => {
    stylesheets().forEach((link) => link.remove());
  });

  it("adds the stylesheet after the existing styles of the page", () => {
    const appStyles = document.head.appendChild(document.createElement("style"));

    applyTenantStylesheet("https://core.example.org", "acme");

    const [link] = stylesheets();
    expect(link.rel).toBe("stylesheet");
    expect(link.href).toBe("https://core.example.org/v4/tenants/acme/theme/css");
    expect(appStyles.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    appStyles.remove();
  });

  it("doesn't add the stylesheet twice when applied repeatedly", () => {
    applyTenantStylesheet("https://core.example.org", "acme");
    applyTenantStylesheet("https://core.example.org", "acme");

    expect(stylesheets()).toHaveLength(1);
  });
});
