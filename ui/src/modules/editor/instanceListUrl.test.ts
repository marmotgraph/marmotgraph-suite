import { describe, expect, it } from "vitest";
import { instanceListSearch, InstanceListState, parseInstanceList } from "./instanceListUrl";

const parse = (search: string) => parseInstanceList(new URLSearchParams(search));

describe("instanceListUrl", () => {
  it("leaves the defaults out", () => {
    expect(instanceListSearch(parse(""), null)).toBe("");
  });

  it("restores what was written", () => {
    const state: InstanceListState = {
      searchTerm: "a b&c",
      typeFilter: ["https://schema/Dataset", "https://schema/Person"],
      spaceFilter: ["common"],
      favoritesOnly: true,
      contributedOnly: true,
      releaseStatusFilter: ["has changed"],
      sort: { by: "NAME", direction: "ASC" },
    };
    expect(parse(instanceListSearch(state, "id-1"))).toEqual(state);
    expect(new URLSearchParams(instanceListSearch(state, "id-1")).get("preview")).toBe("id-1");
  });

  it("distinguishes no sorting from the default sorting", () => {
    expect(parse(instanceListSearch({ ...parse(""), sort: null }, null)).sort).toBeNull();
    expect(parse("").sort).toEqual({ by: "LAST_MODIFICATION", direction: "DESC" });
  });

  it("ignores values it doesn't know", () => {
    const state = parse("release=bogus&sort=BOGUS:UP");
    expect(state.releaseStatusFilter).toEqual([]);
    expect(state.sort).toEqual({ by: "LAST_MODIFICATION", direction: "DESC" });
  });
});
