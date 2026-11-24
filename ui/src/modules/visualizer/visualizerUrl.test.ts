import { describe, expect, it } from "vitest";
import { DEFAULT_HIVE, instanceFromRest, viewFromSearch, visualizerPath } from "./visualizerUrl";

describe("visualizerPath", () => {
  it("addresses the visualizer, or an instance in it", () => {
    expect(visualizerPath(undefined)).toBe("/visualizer");
    expect(visualizerPath("abc")).toBe("/visualizer/instances/abc");
  });

  it("encodes the id", () => {
    expect(visualizerPath("a b/c")).toBe("/visualizer/instances/a%20b%2Fc");
  });

  it("leaves out the default view", () => {
    expect(visualizerPath("abc", { layout: "network", hive: DEFAULT_HIVE })).toBe("/visualizer/instances/abc");
  });

  it("names the layout when it is not the default", () => {
    expect(visualizerPath("abc", { layout: "radial" })).toBe("/visualizer/instances/abc?layout=radial");
  });

  it("names the options of the hive plot when they are not the default, and only for a hive plot", () => {
    expect(visualizerPath("abc", { layout: "hive", hive: DEFAULT_HIVE })).toBe("/visualizer/instances/abc?layout=hive");
    expect(visualizerPath("abc", { layout: "hive", hive: { axisBy: "space", rankBy: "name" } })).toBe(
      "/visualizer/instances/abc?layout=hive&axes=space&rank=name",
    );
    expect(visualizerPath(undefined, { layout: "circle", hive: { axisBy: "space", rankBy: "name" } })).toBe("/visualizer?layout=circle");
  });
});

describe("instanceFromRest", () => {
  it("reads the instance of /visualizer/instances/:id", () => {
    expect(instanceFromRest("instances/abc")).toBe("abc");
    expect(instanceFromRest("instances/abc/")).toBe("abc");
    expect(instanceFromRest("instances/a%20b%2Fc")).toBe("a b/c");
  });

  it("is not fooled by anything else", () => {
    expect(instanceFromRest(undefined)).toBeUndefined();
    expect(instanceFromRest("")).toBeUndefined();
    expect(instanceFromRest("instances")).toBeUndefined();
    expect(instanceFromRest("instances/a/b")).toBeUndefined();
    expect(instanceFromRest("other/abc")).toBeUndefined();
    expect(instanceFromRest("instances/%E0%A4%A")).toBeUndefined();
  });
});

describe("viewFromSearch", () => {
  const read = (query: string) => viewFromSearch(new URLSearchParams(query));

  it("reads what the address says", () => {
    expect(read("layout=hive&axes=space&rank=name")).toEqual({ layout: "hive", hive: { axisBy: "space", rankBy: "name" } });
    expect(read("layout=radial")).toEqual({ layout: "radial", hive: undefined });
  });

  it("ignores what it does not know", () => {
    expect(read("layout=spiral&axes=colour&rank=toString")).toEqual({ layout: undefined, hive: undefined });
    expect(read("")).toEqual({ layout: undefined, hive: undefined });
  });

  it("round-trips with visualizerPath", () => {
    const path = visualizerPath("abc", { layout: "hive", hive: { axisBy: "release", rankBy: "distance" } });
    expect(read(path.split("?")[1])).toEqual({ layout: "hive", hive: { axisBy: "release", rankBy: "distance" } });
  });
});
