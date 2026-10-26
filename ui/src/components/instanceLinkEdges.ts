export type Point = { x: number; y: number };

export type LinkEdgeSide = "incoming" | "outgoing";

/** A measured connection from the open instance to one linked instance. */
export type LinkEdgeInput = {
  id: string;
  side: LinkEdgeSide;
  /**
   * Point on the border of the open instance.
   * Outgoing links use the field they belong to; incoming links use the instance name.
   */
  main: Point;
  /** Point on the linked instance card. */
  link: Point;
  active: boolean;
  /** Type color, used while the connection is highlighted. */
  color?: string;
  dashed: boolean;
};

export type LinkEdge = {
  id: string;
  d: string;
  active: boolean;
  color?: string;
  dashed: boolean;
};

const CORNER = 8;
/** How far the shared trunk sits from the open instance, when the gutter allows it. */
const RAIL_OFFSET = 32;
/** Leaves room for the arrow tip to meet the handle instead of covering it. */
const ARROW_INSET = 9;

/**
 * Smooth-step connectors, the orthogonal edge used by React Flow.
 * Links that leave the same point share a trunk, then branch to their cards.
 * Outgoing links anchored on different fields each get their own trunk.
 */
export function linkEdges(inputs: LinkEdgeInput[]): {
  edges: LinkEdge[];
  ports: Point[];
} {
  const edges: LinkEdge[] = [];
  const ports: Point[] = [];
  const buckets = new Map<string, LinkEdgeInput[]>();

  inputs.forEach((input) => {
    const key = `${input.side}:${n(input.main.x)}:${n(input.main.y)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(input);
    } else {
      buckets.set(key, [input]);
    }
  });

  buckets.forEach((group) => {
    const main = group[0].main;
    const side = group[0].side;
    ports.push(main);
    const railX = railPosition(
      side,
      main.x,
      group.map((input) => input.link.x),
    );
    group.forEach((input) => {
      const { start, end } = directedEnds(input);
      if (Math.hypot(end.x - start.x, end.y - start.y) < 2) {
        return;
      }
      edges.push({
        id: input.id,
        d: smoothStepPath(start, end, railX),
        active: input.active,
        color: input.color,
        dashed: input.dashed,
      });
    });
  });

  edges.sort((a, b) => Number(a.active) - Number(b.active));
  return { edges, ports };
}

/** Reads the open instance and the visible link cards inside a detail layout. */
export function readLinkEdgeInputs(layout: HTMLElement): LinkEdgeInput[] {
  const panel = layout.querySelector<HTMLElement>(".instance-focus-panel");
  const name = panel?.querySelector<HTMLElement>(".instance-name");
  if (!panel || !name) {
    return [];
  }

  const origin = layout.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const nameRect = name.getBoundingClientRect();
  if (panelRect.width < 1 || nameRect.height < 1) {
    return [];
  }

  const nameY = nameRect.top + nameRect.height / 2 - origin.top;
  const ports: Record<LinkEdgeSide, Point> = {
    outgoing: { x: panelRect.right - origin.left, y: nameY },
    incoming: { x: panelRect.left - origin.left, y: nameY },
  };

  const inputs: LinkEdgeInput[] = [];
  layout.querySelectorAll<HTMLElement>("[data-link-edge]").forEach((item, index) => {
    const side = item.dataset.linkEdge;
    if (side !== "incoming" && side !== "outgoing") {
      return;
    }
    const linksPanel = item.closest(".instance-links-panel");
    if (!(linksPanel instanceof HTMLElement) || linksPanel.classList.contains("collapsed")) {
      return;
    }
    const handle = item.querySelector<HTMLElement>("[data-link-handle]");
    if (!handle) {
      return;
    }
    const handleRect = handle.getBoundingClientRect();
    const panelBox = linksPanel.getBoundingClientRect();
    const visible =
      handleRect.bottom > panelBox.top &&
      handleRect.top < panelBox.bottom &&
      handleRect.width > 0;
    if (!visible) {
      return;
    }

    const field = item.dataset.linkField ?? "";
    const instanceId = item.dataset.linkId ?? item.dataset.linkType ?? String(index);
    const link = {
      x: handleRect.left + handleRect.width / 2 - origin.left,
      y: handleRect.top + handleRect.height / 2 - origin.top,
    };
    const sectionAnchor =
      side === "outgoing"
        ? outgoingFieldAnchor(layout, field, ports.outgoing.x, link.y)
        : undefined;
    inputs.push({
      id: `${side}:${field}:${instanceId}:${index}`,
      side,
      main: sectionAnchor ?? ports[side],
      link,
      active:
        item.dataset.linkHighlighted === "true" ||
        item.dataset.linkHot === "true" ||
        item.querySelector("[data-link-highlighted='true'], [data-link-hot='true']") !==
          null,
      color: linkColor(item.dataset.linkColor),
      dashed: item.dataset.linkDashed === "true",
    });
  });
  return inputs;
}

/**
 * Where an outgoing connector meets the open instance: the right edge of the
 * field the link belongs to, level with the card when the card sits beside that field.
 */
function outgoingFieldAnchor(
  layout: HTMLElement,
  field: string,
  panelRight: number,
  linkY: number,
): Point | undefined {
  const section = findFieldSection(layout, field);
  if (!section) {
    return undefined;
  }
  const rect = section.getBoundingClientRect();
  if (rect.height < 1) {
    return undefined;
  }
  const originTop = layout.getBoundingClientRect().top;
  const top = rect.top - originTop;
  const bottom = rect.bottom - originTop;
  return {
    x: panelRight,
    y: Math.min(Math.max(linkY, top), bottom),
  };
}

function findFieldSection(layout: HTMLElement, field: string) {
  if (!field) {
    return undefined;
  }
  const sections = layout.querySelectorAll<HTMLElement>("[data-instance-field]");
  for (const section of sections) {
    if (section.dataset.instanceField === field) {
      return section;
    }
  }
  return undefined;
}

export function smoothStepPath(from: Point, to: Point, railX: number): string {
  if (Math.abs(to.y - from.y) < 1.5) {
    return `M ${n(from.x)} ${n(from.y)} L ${n(to.x)} ${n(to.y)}`;
  }

  const dirY = to.y > from.y ? 1 : -1;
  const fromSign = railX >= from.x ? 1 : -1;
  const toSign = to.x >= railX ? 1 : -1;
  const radius = Math.min(
    CORNER,
    Math.abs(to.y - from.y) / 2,
    Math.abs(railX - from.x) / 2,
    Math.abs(to.x - railX) / 2,
  );

  if (radius < 1) {
    return `M ${n(from.x)} ${n(from.y)} L ${n(railX)} ${n(from.y)} L ${n(railX)} ${n(to.y)} L ${n(to.x)} ${n(to.y)}`;
  }

  return [
    `M ${n(from.x)} ${n(from.y)}`,
    `L ${n(railX - fromSign * radius)} ${n(from.y)}`,
    `Q ${n(railX)} ${n(from.y)} ${n(railX)} ${n(from.y + dirY * radius)}`,
    `L ${n(railX)} ${n(to.y - dirY * radius)}`,
    `Q ${n(railX)} ${n(to.y)} ${n(railX + toSign * radius)} ${n(to.y)}`,
    `L ${n(to.x)} ${n(to.y)}`,
  ].join(" ");
}

function directedEnds(input: LinkEdgeInput): { start: Point; end: Point } {
  if (input.side === "outgoing") {
    const span = input.link.x - input.main.x;
    const inset = Math.min(ARROW_INSET, Math.max(0, span * 0.25));
    return {
      start: input.main,
      end: { x: input.link.x - inset, y: input.link.y },
    };
  }
  const span = input.main.x - input.link.x;
  const inset = Math.min(ARROW_INSET, Math.max(0, span * 0.25));
  return {
    start: input.link,
    end: { x: input.main.x - inset, y: input.main.y },
  };
}

function railPosition(side: LinkEdgeSide, mainX: number, linkXs: number[]) {
  if (side === "outgoing") {
    const nearest = Math.min(...linkXs);
    const span = nearest - mainX;
    if (span < 16) {
      return mainX + span / 2;
    }
    return mainX + Math.min(RAIL_OFFSET, span * 0.5);
  }
  const nearest = Math.max(...linkXs);
  const span = mainX - nearest;
  if (span < 16) {
    return mainX - span / 2;
  }
  return mainX - Math.min(RAIL_OFFSET, span * 0.5);
}

function linkColor(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const color = value.trim();
  if (
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
      color,
    ) ||
    /^[a-zA-Z]{3,20}$/.test(color)
  ) {
    return color;
  }
  return undefined;
}

function n(value: number) {
  return Math.round(value * 10) / 10;
}
