import { SpatialGrid } from "./spatial";

const near = (grid: SpatialGrid, x: number, y: number, range: number): number[] => {
  const found: number[] = [];
  grid.forEachNear(x, y, range, (i) => found.push(i));
  return found.sort((a, b) => a - b);
};

describe("SpatialGrid", () => {
  it("finds the points around a position, and only those", () => {
    const grid = new SpatialGrid();
    grid.rebuild([0, 10, 500, 1000], [0, 10, 500, 1000], 4);
    expect(near(grid, 0, 0, 20)).toEqual([0, 1]);
    expect(near(grid, 500, 500, 20)).toEqual([2]);
    expect(near(grid, 5000, 5000, 20)).toEqual([]);
  });

  it("never misses a point within range of a position outside of the grid", () => {
    const grid = new SpatialGrid();
    grid.rebuild([0, 100], [0, 100], 2);
    expect(near(grid, -30, 0, 40)).toContain(0);
    expect(near(grid, 130, 100, 40)).toContain(1);
  });

  it("is empty without points", () => {
    const grid = new SpatialGrid();
    grid.rebuild([], [], 0);
    expect(near(grid, 0, 0, 100)).toEqual([]);
  });

  it("agrees with a scan of all points", () => {
    const count = 3000;
    const x = Float64Array.from({ length: count }, (_, i) => ((i * 7919) % 4000) - 2000);
    const y = Float64Array.from({ length: count }, (_, i) => ((i * 104729) % 3000) - 1500);
    const grid = new SpatialGrid();
    grid.rebuild(x, y, count);
    for (const [px, py, range] of [
      [0, 0, 60],
      [-1800, 1200, 120],
      [1500, -900, 40],
    ]) {
      const exact = [...Array(count).keys()].filter((i) => Math.abs(x[i] - px) <= range && Math.abs(y[i] - py) <= range);
      const candidates = new Set(near(grid, px, py, range));
      exact.forEach((i) => expect(candidates.has(i)).toBe(true));
    }
  });

  it("keeps its size in check for points far apart", () => {
    const grid = new SpatialGrid();
    grid.rebuild([0, 1e9], [0, 1e9], 2);
    expect(near(grid, 1e9, 1e9, 10)).toEqual([1]);
  });
});
