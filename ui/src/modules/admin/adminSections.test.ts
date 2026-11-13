import { adminSections } from "./adminSections";

describe("adminSections", () => {
  it("provides the sections in the order of the navigation", () => {
    expect(adminSections(["DEFINE_TOOLS", "TENANT_MANAGEMENT", "READ", "CREATE_PERMISSION"])).toEqual(["permissions", "tenants", "tools"]);
  });

  it("provides the permissions with the right to create or to delete permissions", () => {
    expect(adminSections(["CREATE_PERMISSION"])).toEqual(["permissions"]);
    expect(adminSections(["DELETE_PERMISSION"])).toEqual(["permissions"]);
  });

  it("provides nothing without the required functionalities", () => {
    expect(adminSections(["READ", "MANAGE_SPACE"])).toEqual([]);
    expect(adminSections(undefined)).toEqual([]);
  });
});
