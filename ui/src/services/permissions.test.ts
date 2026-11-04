import { individualClaims } from "./permissions";

describe("individualClaims", () => {
  it("splits nested lists into one claim per entry", () => {
    expect(
      individualClaims({ roles: { group: ["a", "b"] }, email: "x@example.org" }),
    ).toEqual([
      { roles: { group: ["a"] } },
      { roles: { group: ["b"] } },
      { email: "x@example.org" },
    ]);
  });

  it("keeps empty values as they are", () => {
    expect(individualClaims({ a: [], b: {} })).toEqual([{ a: [] }, { b: {} }]);
  });

  it("provides nothing for empty claims", () => {
    expect(individualClaims({})).toEqual([]);
  });
});
