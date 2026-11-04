import { loadPositions, POSITIONS_KEY, savePositions } from "./nodePositions";

describe("nodePositions", () => {
  afterEach(() => localStorage.clear());

  it("stores the positions in the local storage", () => {
    savePositions(new Map([["https://example.org/types/Device", { x: 12.345, y: -3 }]]));
    expect(JSON.parse(localStorage.getItem(POSITIONS_KEY)!)).toEqual({ "https://example.org/types/Device": [12.3, -3] });
    expect(loadPositions()).toEqual(new Map([["https://example.org/types/Device", { x: 12.3, y: -3 }]]));
  });

  it("removes the positions if there are none", () => {
    savePositions(new Map([["a", { x: 1, y: 2 }]]));
    savePositions(new Map());
    expect(localStorage.getItem(POSITIONS_KEY)).toBeNull();
  });

  it("ignores invalid content", () => {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify({ a: [1, 2], b: "x", c: [1], d: [1, null] }));
    expect(loadPositions()).toEqual(new Map([["a", { x: 1, y: 2 }]]));
    localStorage.setItem(POSITIONS_KEY, "not json");
    expect(loadPositions()).toEqual(new Map());
  });
});
