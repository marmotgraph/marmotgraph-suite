import { adminSections } from "./adminSections";

describe("adminSections", () => {
  it("provides the sections in the order of the navigation", () => {
    expect(adminSections(["DEFINE_TOOLS", "TENANT_MANAGEMENT", "READ", "CREATE_PERMISSION"])).toEqual(["permissions", "tenants", "tools", "import-export"]);
  });

  it("provides the permissions with the right to create or to delete permissions", () => {
    expect(adminSections(["CREATE_PERMISSION"])).toEqual(["permissions", "import-export"]);
    expect(adminSections(["DELETE_PERMISSION"])).toEqual(["permissions", "import-export"]);
  });

  it("provides the import/export to the users managing the spaces", () => {
    expect(adminSections(["READ", "MANAGE_SPACE"])).toEqual(["import-export"]);
  });

  it("provides nothing without the required functionalities", () => {
    expect(adminSections(["READ"])).toEqual([]);
    expect(adminSections(undefined)).toEqual([]);
  });
});
