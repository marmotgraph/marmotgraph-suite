import { EngineInput, ForceEngine, tuningFor } from "./forceEngine";

/** A ring of clusters: enough structure for the forces to have something to do. */
function input(count: number): EngineInput {
  const links: number[] = [];
  for (let i = 1; i < count; i++) {
    links.push(i, Math.floor(i / 3));
  }
  return {
    x: Float64Array.from({ length: count }, (_, i) => Math.cos(i) * (20 + (i % 50))),
    y: Float64Array.from({ length: count }, (_, i) => Math.sin(i) * (20 + (i % 50))),
    radius: Float64Array.from({ length: count }, () => 10),
    links: Uint32Array.from(links),
  };
}

describe("tuningFor", () => {
  it("gets cheaper the bigger the graph", () => {
    const small = tuningFor(100);
    const big = tuningFor(10000);
    expect(big.collide).toBe(false);
    expect(small.collide).toBe(true);
    expect(big.distanceMax).toBeLessThan(small.distanceMax);
    expect(big.theta).toBeGreaterThan(small.theta);
    expect(big.alphaDecay).toBeGreaterThan(small.alphaDecay);
  });
});

describe("ForceEngine", () => {
  it("settles, and leaves finite positions", () => {
    const engine = new ForceEngine(input(200));
    expect(engine.running).toBe(true);
    engine.step(Infinity, 2000);
    expect(engine.running).toBe(false);
    const xy = new Float32Array(400);
    engine.write(xy);
    expect([...xy].every(Number.isFinite)).toBe(true);
  });

  it("keeps a pinned node where it was put - and keeps going while one is held", () => {
    const engine = new ForceEngine(input(50));
    engine.pin(3, 500, -500);
    engine.reheat(0.25);
    engine.step(Infinity, 400);
    expect(engine.running).toBe(true);
    const xy = new Float32Array(100);
    engine.write(xy);
    expect([xy[6], xy[7]]).toEqual([500, -500]);
    engine.release(3);
    engine.reheat(0);
    engine.step(Infinity, 3000);
    expect(engine.running).toBe(false);
  });

  it("stops at its time budget", { retry: 2 }, () => {
    const engine = new ForceEngine(input(2000));
    const started = performance.now();
    engine.step(5);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("handles a thousand-plus nodes in a few seconds of ticks", { retry: 2 }, () => {
    const engine = new ForceEngine(input(4000));
    const started = performance.now();
    engine.step(Infinity, 30);
    // 30 ticks of 4000 nodes - generous, this is about catching an accidental quadratic step
    expect(performance.now() - started).toBeLessThan(8000);
  });
});
