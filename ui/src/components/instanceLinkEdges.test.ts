import { linkEdges, readLinkEdgeInputs, smoothStepPath } from "./instanceLinkEdges";

function rect(partial: Partial<DOMRect>): DOMRect {
  const box = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON() {
      return box;
    },
    ...partial,
  };
  return box as DOMRect;
}

function mockRect(element: Element, box: Partial<DOMRect>) {
  element.getBoundingClientRect = () => rect(box);
}

describe("smoothStepPath", () => {
  it("draws a straight line when the cards line up", () => {
    expect(smoothStepPath({ x: 0, y: 20 }, { x: 80, y: 20 }, 32)).toBe(
      "M 0 20 L 80 20",
    );
  });

  it("rounds the trunk between the instance and the linked card", () => {
    expect(smoothStepPath({ x: 0, y: 0 }, { x: 90, y: 80 }, 32)).toBe(
      "M 0 0 L 24 0 Q 32 0 32 8 L 32 72 Q 32 80 40 80 L 90 80",
    );
  });
});

describe("linkEdges", () => {
  it("shares one trunk and points outgoing links at the linked instance", () => {
    const { edges, ports } = linkEdges([
      {
        id: "a",
        side: "outgoing",
        main: { x: 0, y: 0 },
        link: { x: 100, y: 80 },
        active: false,
        dashed: false,
      },
      {
        id: "b",
        side: "outgoing",
        main: { x: 0, y: 0 },
        link: { x: 140, y: 140 },
        active: true,
        color: "#4caf50",
        dashed: false,
      },
    ]);

    expect(ports).toEqual([{ x: 0, y: 0 }]);
    expect(edges.map((edge) => edge.id)).toEqual(["a", "b"]);
    expect(edges[0].d).toContain("Q 32 0 32 8");
    expect(edges[1].d.endsWith("L 131 140")).toBe(true);
    expect(edges[1].color).toBe("#4caf50");
  });

  it("points incoming links back at the open instance", () => {
    const { edges, ports } = linkEdges([
      {
        id: "in",
        side: "incoming",
        main: { x: 200, y: 40 },
        link: { x: 40, y: 100 },
        active: false,
        dashed: true,
      },
    ]);

    expect(ports).toEqual([{ x: 200, y: 40 }]);
    expect(edges[0].d.startsWith("M 40 100")).toBe(true);
    expect(edges[0].d.endsWith("L 191 40")).toBe(true);
    expect(edges[0].dashed).toBe(true);
  });

  it("gives each outgoing field its own trunk", () => {
    const { ports, edges } = linkEdges([
      {
        id: "contains",
        side: "outgoing",
        main: { x: 0, y: 40 },
        link: { x: 80, y: 40 },
        active: false,
        dashed: false,
      },
      {
        id: "location",
        side: "outgoing",
        main: { x: 0, y: 140 },
        link: { x: 80, y: 140 },
        active: false,
        dashed: false,
      },
    ]);

    expect(ports).toEqual([
      { x: 0, y: 40 },
      { x: 0, y: 140 },
    ]);
    expect(edges.map((edge) => edge.d)).toEqual([
      "M 0 40 L 71 40",
      "M 0 140 L 71 140",
    ]);
  });
});

describe("readLinkEdgeInputs", () => {
  it("measures a visible link card against the instance name", () => {
    const layout = document.createElement("div");
    const panel = document.createElement("div");
    panel.className = "instance-focus-panel";
    const name = document.createElement("h2");
    name.className = "instance-name";
    panel.append(name);
    const links = document.createElement("div");
    links.className = "instance-links-panel";
    const item = document.createElement("div");
    item.dataset.linkEdge = "outgoing";
    item.dataset.linkId = "a";
    item.dataset.linkField = "Site";
    item.dataset.linkColor = "#4caf50";
    item.dataset.linkHighlighted = "true";
    const handle = document.createElement("span");
    handle.dataset.linkHandle = "";
    item.append(handle);
    links.append(item);
    layout.append(panel, links);

    mockRect(layout, { left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600 });
    mockRect(panel, { left: 300, top: 40, width: 400, height: 300, right: 700, bottom: 340 });
    mockRect(name, { left: 330, top: 80, width: 200, height: 30, right: 530, bottom: 110 });
    mockRect(links, { left: 740, top: 40, width: 140, height: 400, right: 880, bottom: 440 });
    mockRect(handle, { left: 750, top: 100, width: 9, height: 9, right: 759, bottom: 109 });

    expect(readLinkEdgeInputs(layout)).toEqual([
      {
        id: "outgoing:Site:a:0",
        side: "outgoing",
        main: { x: 700, y: 95 },
        link: { x: 754.5, y: 104.5 },
        active: true,
        color: "#4caf50",
        dashed: false,
      },
    ]);
  });

  it("skips cards scrolled out of the links panel and ignores unsafe colors", () => {
    const layout = document.createElement("div");
    const panel = document.createElement("div");
    panel.className = "instance-focus-panel";
    const name = document.createElement("h2");
    name.className = "instance-name";
    panel.append(name);
    const links = document.createElement("div");
    links.className = "instance-links-panel";

    const hidden = document.createElement("div");
    hidden.dataset.linkEdge = "incoming";
    hidden.dataset.linkId = "hidden";
    const hiddenHandle = document.createElement("span");
    hiddenHandle.dataset.linkHandle = "";
    hidden.append(hiddenHandle);

    const visible = document.createElement("div");
    visible.dataset.linkEdge = "incoming";
    visible.dataset.linkId = "shown";
    visible.dataset.linkColor = "red;background:url(x)";
    const visibleHandle = document.createElement("span");
    visibleHandle.dataset.linkHandle = "";
    visible.append(visibleHandle);

    links.append(hidden, visible);
    layout.append(panel, links);

    mockRect(layout, { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 });
    mockRect(panel, { left: 40, top: 0, right: 80, bottom: 80, width: 40, height: 80 });
    mockRect(name, { left: 40, top: 10, right: 70, bottom: 30, width: 30, height: 20 });
    mockRect(links, { left: 0, top: 20, right: 30, bottom: 80, width: 30, height: 60 });
    mockRect(hiddenHandle, { left: 4, top: 0, right: 12, bottom: 8, width: 8, height: 8 });
    mockRect(visibleHandle, { left: 4, top: 40, right: 12, bottom: 48, width: 8, height: 8 });

    const inputs = readLinkEdgeInputs(layout);
    expect(inputs.map((input) => input.id)).toEqual(["incoming::shown:1"]);
    expect(inputs[0].color).toBeUndefined();
  });

  it("anchors an outgoing link on the field it comes from", () => {
    const layout = document.createElement("div");
    const panel = document.createElement("div");
    panel.className = "instance-focus-panel";
    const name = document.createElement("h2");
    name.className = "instance-name";
    panel.append(name);
    const section = document.createElement("div");
    section.dataset.instanceField = "Site";
    panel.append(section);
    const links = document.createElement("div");
    links.className = "instance-links-panel";
    const item = document.createElement("div");
    item.dataset.linkEdge = "outgoing";
    item.dataset.linkId = "a";
    item.dataset.linkField = "Site";
    const handle = document.createElement("span");
    handle.dataset.linkHandle = "";
    item.append(handle);
    links.append(item);
    layout.append(panel, links);

    mockRect(layout, { left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600 });
    mockRect(panel, { left: 300, top: 40, width: 400, height: 300, right: 700, bottom: 340 });
    mockRect(name, { left: 330, top: 80, width: 200, height: 30, right: 530, bottom: 110 });
    mockRect(section, { left: 330, top: 180, width: 340, height: 70, right: 670, bottom: 250 });
    mockRect(links, { left: 740, top: 40, width: 140, height: 400, right: 880, bottom: 440 });
    mockRect(handle, { left: 750, top: 200, width: 9, height: 9, right: 759, bottom: 209 });

    const [input] = readLinkEdgeInputs(layout);
    expect(input.main).toEqual({ x: 700, y: 204.5 });
    expect(input.link.y).toBe(204.5);
  });

  it("draws one outgoing connector for a type, not one per instance", () => {
    const layout = document.createElement("div");
    const panel = document.createElement("div");
    panel.className = "instance-focus-panel";
    const name = document.createElement("h2");
    name.className = "instance-name";
    panel.append(name);
    const links = document.createElement("div");
    links.className = "instance-links-panel";
    const type = document.createElement("div");
    type.dataset.linkEdge = "outgoing";
    type.dataset.linkField = "Members";
    type.dataset.linkType = "Animal";
    type.dataset.linkColor = "#9c27b0";
    const handle = document.createElement("span");
    handle.dataset.linkHandle = "";
    const hot = document.createElement("div");
    hot.dataset.linkHot = "true";
    const other = document.createElement("div");
    type.append(handle, hot, other);
    links.append(type);
    layout.append(panel, links);

    mockRect(layout, { left: 0, top: 0, width: 900, height: 400, right: 900, bottom: 400 });
    mockRect(panel, { left: 200, top: 0, width: 400, height: 300, right: 600, bottom: 300 });
    mockRect(name, { left: 220, top: 10, width: 100, height: 20, right: 320, bottom: 30 });
    mockRect(links, { left: 680, top: 0, width: 200, height: 300, right: 880, bottom: 300 });
    mockRect(handle, { left: 690, top: 40, width: 9, height: 9, right: 699, bottom: 49 });

    const inputs = readLinkEdgeInputs(layout);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].id).toBe("outgoing:Members:Animal:0");
    expect(inputs[0].active).toBe(true);
    expect(inputs[0].color).toBe("#9c27b0");
    expect(inputs[0].link).toEqual({ x: 694.5, y: 44.5 });
  });
});
