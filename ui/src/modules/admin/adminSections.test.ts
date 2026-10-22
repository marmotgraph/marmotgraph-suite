import { adminSections } from "./adminSections";

describe("adminSections", () => {
  it("provides the sections in the order of the tabs", () => {
    expect(adminSections(["TENANT_MANAGEMENT", "READ", "CREATE_PERMISSION"])).toEqual(["permissions", "tenants"]);
  });

  it("provides nothing without the required functionalities", () => {
    expect(adminSections(["READ", "DELETE_PERMISSION"])).toEqual([]);
    expect(adminSections(undefined)).toEqual([]);
  });
});
