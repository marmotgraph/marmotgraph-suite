import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { drag } from "d3-drag";
import { select } from "d3-selection";
import { D3ZoomEvent, zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from "d3-zoom";
import type { LinkStatus } from "../editor/editorMockData";
import { BADGE_HIT_RADIUS, BADGE_MIN_ZOOM, badgeCentre, buildScene, drawFrame, effectiveRadius, focusMask } from "./canvasRenderer";
import { ForceHandle, startForce } from "./forceClient";
import { circleLayout, hiveLayout, HiveOptions, LayoutKind, LayoutNode, Point, radialLayout, StaticLayout } from "./layouts";
import { SpatialGrid } from "./spatial";

export interface CanvasNode extends LayoutNode {
  initial: string;
  status: LinkStatus;
  /** Whether it has links which are not in the graph yet */
  expandable: boolean;
}

export interface CanvasLink {
  id: string;
  source: string;
  target: string;
  labels: string[];
  /** There is a link in the opposite direction too */
  curved: boolean;
}

export interface GraphCanvasHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
}

interface GraphCanvasProps {
  nodes: CanvasNode[];
  links: CanvasLink[];
  layout: LayoutKind;
  hive: HiveOptions;
  /** Hops from the selection per node - what the hive plot and the radial layout are arranged by */
  hops: ReadonlyMap<string, number>;
  selectedId?: string;
  showLabels: boolean;
  showLinkLabels: boolean;
  showArrows: boolean;
  onSelect: (id: string | undefined) => void;
  onExpand: (id: string) => void;
}

/** Where the nodes are - by index, in the order of the `nodes` prop. */
interface Geometry {
  ids: string[];
  x: Float64Array;
  y: Float64Array;
}

interface Hit {
  index: number;
  /** The expand badge of the node was hit, not the node */
  badge: boolean;
}

interface DragSubject {
  x: number;
  y: number;
  index: number;
}

const MAX_FIT_SCALE = 1.4;
const MIN_SCALE = 0.02;
const MAX_SCALE = 4;
const FIT_PADDING = 56;
const MORPH_MS = 750;
const FIT_MS = 450;
/** The fit follows a running simulation at most this often */
const LIVE_FIT_MS = 700;
/** From this many nodes on the graph is drawn in a lighter way while it moves */
const LITE_NODES = 2500;
const GESTURE_MS = 140;

const prefersReducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Runs the callback with the eased progress on each frame - returns what cancels it. */
function animate(duration: number, step: (progress: number) => void, done?: () => void): () => void {
  if (prefersReducedMotion()) {
    step(1);
    done?.();
    return () => undefined;
  }
  const started = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const progress = Math.min(1, (now - started) / duration);
    step(ease(progress));
    if (progress < 1) {
      frame = requestAnimationFrame(tick);
    } else {
      done?.();
    }
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/** A deterministic spot near the origin (for nodes without any neighbour to start next to). */
function scatter(id: string): Point {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const angle = (hash % 360) * (Math.PI / 180);
  const distance = 20 + (hash % 60);
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

/** Where an event happened, relative to the canvas (mouse, pointer and touch events). */
function pointOf(event: Event, canvas: HTMLCanvasElement): [number, number] | undefined {
  const source = (event as TouchEvent).touches?.[0] ?? (event as MouseEvent);
  if (typeof source.clientX !== "number") {
    return undefined;
  }
  const rect = canvas.getBoundingClientRect();
  return [source.clientX - rect.left, source.clientY - rect.top];
}

/**
 * The graph on a canvas, however many nodes there are. The network is simulated live in a worker (nodes can be
 * dragged); the other representations are computed at once and the nodes glide to their places. Painting is batched
 * and skips what can't be seen (see canvasRenderer), and what is under the pointer is found through a grid - so
 * thousands of instances stay smooth. The canvas is operable with the keyboard (arrow keys move between nodes).
 */
const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(props, handle) {
  const { nodes, links, layout, hive, hops, selectedId, showLabels, showLinkLabels, showArrows, onSelect, onExpand } = props;
  const hintId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown>>(undefined);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const size = useRef({ width: 0, height: 0, dpr: 1 });
  const fontFamily = useRef("sans-serif");
  const geometry = useRef<Geometry>({ ids: [], x: new Float64Array(0), y: new Float64Array(0) });
  const staticLayout = useRef<StaticLayout>(undefined);
  const angles = useRef<Float64Array>(undefined);
  const routing = useRef<LayoutKind>(layout);
  const force = useRef<ForceHandle>(undefined);
  const simulating = useRef(false);
  const gesture = useRef(false);
  const gestureTimer = useRef(0);
  const cancelMotion = useRef<() => void>(() => undefined);
  const cancelFit = useRef<() => void>(() => undefined);
  const lastLiveFit = useRef(0);
  const autoFit = useRef(true);
  /** Set while the program (not the user) moves the view */
  const programmatic = useRef(false);
  const frame = useRef(0);
  const grid = useRef(new SpatialGrid());
  const gridStale = useRef(true);
  const focusBuffer = useRef<Uint8Array>(undefined);
  const focusShown = useRef<Uint8Array>(undefined);
  const hoverIndex = useRef(-1);
  const hasFocus = useRef(false);
  const cursor = useRef(-1);
  const [hover, setHover] = useState<{ id: string; x: number; y: number }>();
  const [caption, setCaption] = useState<string>();
  const [announcement, setAnnouncement] = useState("");

  const scene = useMemo(() => buildScene(nodes, links), [nodes, links]);
  const hovered = hover?.id;

  const latest = useRef({ scene, layout, hive, hops, selectedId, hovered, showLabels, showLinkLabels, showArrows });
  latest.current = { scene, layout, hive, hops, selectedId, hovered, showLabels, showLinkLabels, showArrows };

  // ---- Painting ----

  const draw = useCallback(() => {
    frame.current = 0;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const geo = geometry.current;
    const s = latest.current;
    const count = s.scene.nodes.length;
    if (!context || geo.x.length !== count || size.current.width === 0) {
      return;
    }
    const hoveredAt = s.hovered ? (s.scene.index.get(s.hovered) ?? -1) : -1;
    const selectedAt = s.selectedId ? (s.scene.index.get(s.selectedId) ?? -1) : -1;
    const active = hoveredAt >= 0 ? hoveredAt : selectedAt;
    const focus = active >= 0 ? focusMask(s.scene, active, focusBuffer.current) : undefined;
    focusBuffer.current = focus ?? focusBuffer.current;
    focusShown.current = focus;
    const t = transformRef.current;
    drawFrame(context, s.scene, {
      viewport: { x: t.x, y: t.y, k: t.k, ...size.current },
      x: geo.x,
      y: geo.y,
      layout: routing.current,
      angle: angles.current,
      guides: staticLayout.current?.guides ?? [],
      active,
      selected: selectedAt,
      cursor: hasFocus.current ? cursor.current : -1,
      focus,
      labels: s.showLabels,
      linkLabels: s.showLinkLabels,
      arrows: s.showArrows,
      lite: count > LITE_NODES && (simulating.current || gesture.current),
      fontFamily: fontFamily.current,
    });
  }, []);

  /** Paints on the next frame - any number of requests before it count as one. */
  const requestDraw = useCallback(() => {
    if (!frame.current) {
      frame.current = requestAnimationFrame(draw);
    }
  }, [draw]);

  // ---- Positions ----

  /** New nodes start next to a neighbour which is placed already - so they grow out of it. */
  useLayoutEffect(() => {
    const previous = geometry.current;
    const count = scene.nodes.length;
    let same = previous.ids.length === count;
    for (let i = 0; same && i < count; i++) {
      same = previous.ids[i] === scene.nodes[i].id;
    }
    if (same) {
      return;
    }
    const before = new Map<string, number>();
    previous.ids.forEach((id, i) => before.set(id, i));
    const x = new Float64Array(count);
    const y = new Float64Array(count);
    const placed = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const at = before.get(scene.nodes[i].id);
      if (at !== undefined) {
        x[i] = previous.x[at];
        y[i] = previous.y[at];
        placed[i] = 1;
      }
    }
    for (let i = 0; i < count; i++) {
      if (placed[i]) continue;
      let anchor = -1;
      for (let a = scene.adjacencyStart[i]; a < scene.adjacencyStart[i + 1]; a++) {
        if (placed[scene.adjacency[a]]) {
          anchor = scene.adjacency[a];
          break;
        }
      }
      const jitter = scatter(scene.nodes[i].id);
      x[i] = anchor >= 0 ? x[anchor] + jitter.x * 0.5 : jitter.x;
      y[i] = anchor >= 0 ? y[anchor] + jitter.y * 0.5 : jitter.y;
      placed[i] = 1;
    }
    geometry.current = { ids: scene.nodes.map((n) => n.id), x, y };
    gridStale.current = true;
  }, [scene]);

  // ---- What is under the pointer ----

  const hitAt = useCallback((px: number, py: number): Hit | undefined => {
    const { scene: sc } = latest.current;
    const geo = geometry.current;
    const count = sc.nodes.length;
    if (count === 0 || geo.x.length !== count) {
      return undefined;
    }
    if (gridStale.current) {
      grid.current.rebuild(geo.x, geo.y, count);
      gridStale.current = false;
    }
    const t = transformRef.current;
    const wx = (px - t.x) / t.k;
    const wy = (py - t.y) / t.k;
    const slop = 3 / t.k; // a little forgiveness for the pointer
    const reach = effectiveRadius(sc.maxRadius, t.k) * 1.05 + BADGE_HIT_RADIUS + slop;
    const foreground = focusShown.current;
    let node = -1;
    let nodeDistance = Infinity;
    let badge = -1;
    let badgeDistance = Infinity;
    grid.current.forEachNear(wx, wy, reach, (i) => {
      const r = effectiveRadius(sc.nodes[i].radius, t.k);
      const d = Math.hypot(geo.x[i] - wx, geo.y[i] - wy);
      if (d <= r + slop && d < nodeDistance) {
        node = i;
        nodeDistance = d;
      }
      if (t.k >= BADGE_MIN_ZOOM && sc.nodes[i].expandable && (!foreground || foreground[i] === 1)) {
        const [bx, by] = badgeCentre(geo.x[i], geo.y[i], r);
        const bd = Math.hypot(bx - wx, by - wy);
        if (bd <= BADGE_HIT_RADIUS + slop && bd < badgeDistance) {
          badge = i;
          badgeDistance = bd;
        }
      }
    });
    if (badge >= 0) return { index: badge, badge: true };
    return node >= 0 ? { index: node, badge: false } : undefined;
  }, []);

  // ---- Zoom ----

  const fitTransform = useCallback((): ZoomTransform | undefined => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1) {
      return undefined;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const include = (x: number, y: number, pad = 0) => {
      minX = Math.min(minX, x - pad);
      maxX = Math.max(maxX, x + pad);
      minY = Math.min(minY, y - pad);
      maxY = Math.max(maxY, y + pad);
    };
    const geo = geometry.current;
    const ns = latest.current.scene.nodes;
    if (geo.x.length === ns.length) {
      for (let i = 0; i < ns.length; i++) {
        include(geo.x[i], geo.y[i], ns[i].radius + 22);
      }
    }
    if (latest.current.layout !== "network") {
      (staticLayout.current?.guides ?? []).forEach((guide) => {
        if (guide.kind === "ring") include(0, 0, guide.r);
        else include(guide.labelAt.x, guide.labelAt.y, 60);
      });
    }
    if (!isFinite(minX)) {
      return zoomIdentity.translate(width / 2, height / 2);
    }
    const scale = Math.max(MIN_SCALE, Math.min(MAX_FIT_SCALE, (width - 2 * FIT_PADDING) / (maxX - minX), (height - 2 * FIT_PADDING) / (maxY - minY)));
    return zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
  }, []);

  const applyTransform = useCallback((target: ZoomTransform, animated: boolean) => {
    const canvas = canvasRef.current;
    const behavior = zoomRef.current;
    if (!canvas || !behavior) {
      return;
    }
    cancelFit.current();
    const from = transformRef.current;
    const move = (p: number) =>
      behavior.transform(
        select(canvas),
        zoomIdentity.translate(from.x + (target.x - from.x) * p, from.y + (target.y - from.y) * p).scale(from.k + (target.k - from.k) * p),
      );
    if (!animated) {
      move(1);
      return;
    }
    cancelFit.current = animate(FIT_MS, move);
  }, []);

  /** Shows everything - and keeps doing so after layout changes until the user moves the view. */
  const fit = useCallback(
    (animated = true) => {
      const target = fitTransform();
      if (target) {
        // The zoom event of the program is no gesture of the user
        programmatic.current = true;
        applyTransform(target, animated);
        window.setTimeout(() => (programmatic.current = false), animated ? FIT_MS + 50 : 0);
      }
    },
    [applyTransform, fitTransform],
  );

  const zoomBy = useCallback((factor: number) => {
    autoFit.current = false;
    const canvas = canvasRef.current;
    if (canvas && zoomRef.current) {
      zoomRef.current.scaleBy(select(canvas), factor);
    }
  }, []);

  useImperativeHandle(
    handle,
    () => ({
      fit: () => {
        autoFit.current = true;
        fit();
      },
      zoomBy,
    }),
    [fit, zoomBy],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return undefined;
    }
    fontFamily.current = getComputedStyle(canvas).fontFamily || "sans-serif";

    const behavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .filter((event: Event) => {
        if ((event instanceof MouseEvent && event.button) || event.type === "dblclick") {
          return false;
        }
        // A press on a node of the network drags the node - it is not the start of a pan
        if (latest.current.layout === "network" && (event.type === "mousedown" || event.type === "touchstart")) {
          const point = pointOf(event, canvas);
          const hit = point && hitAt(point[0], point[1]);
          if (hit && !hit.badge) {
            return false;
          }
        }
        return true;
      })
      .on("zoom", (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
        gesture.current = true;
        window.clearTimeout(gestureTimer.current);
        gestureTimer.current = window.setTimeout(() => {
          gesture.current = false;
          requestDraw();
        }, GESTURE_MS);
        if (event.sourceEvent && !programmatic.current) {
          // The user took over the view
          autoFit.current = false;
          cancelFit.current();
        }
        if (event.sourceEvent) {
          hoverIndex.current = -1;
          setHover(undefined);
        }
        requestDraw();
      });
    zoomRef.current = behavior;
    select(canvas).call(behavior);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      size.current = { width, height, dpr };
      if (autoFit.current) {
        fit(false);
      }
      requestDraw();
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
    observer?.observe(container);
    return () => {
      observer?.disconnect();
      window.clearTimeout(gestureTimer.current);
      gesture.current = false; // the timer which would have reset it is gone
      select(canvas).on(".zoom", null);
    };
    // hitAt and requestDraw are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, requestDraw]);

  // ---- Layout: the network runs live, the others move the nodes to their places ----

  const hiveKey = `${hive.axisBy}/${hive.rankBy}`;
  const arrangedBy = layout === "radial" || (layout === "hive" && hive.rankBy === "distance") ? (selectedId ?? "") : "";

  useEffect(() => {
    const { scene: sc, layout: kind } = latest.current;
    cancelMotion.current();
    force.current?.stop();
    force.current = undefined;
    simulating.current = false;
    routing.current = kind;
    const geo = geometry.current;
    if (geo.x.length !== sc.nodes.length) {
      return undefined;
    }

    if (kind === "network") {
      staticLayout.current = undefined;
      angles.current = undefined;
      setCaption(undefined);
      const pairs: number[] = [];
      for (let i = 0; i < sc.links.length; i++) {
        if (sc.linkSource[i] >= 0 && sc.linkTarget[i] >= 0) {
          pairs.push(sc.linkSource[i], sc.linkTarget[i]);
        }
      }
      const handleOfRun = startForce(
        {
          x: Float64Array.from(geo.x),
          y: Float64Array.from(geo.y),
          radius: Float64Array.from(sc.nodes, (n) => n.radius),
          links: Uint32Array.from(pairs),
        },
        (xy, running) => {
          const current = geometry.current;
          if (current.x.length * 2 !== xy.length) {
            return; // of a graph which is gone
          }
          for (let i = 0; i < current.x.length; i++) {
            current.x[i] = xy[2 * i];
            current.y[i] = xy[2 * i + 1];
          }
          simulating.current = running;
          gridStale.current = true;
          requestDraw();
          const now = performance.now();
          if (autoFit.current && (!running || now - lastLiveFit.current > LIVE_FIT_MS)) {
            lastLiveFit.current = now;
            fit(running);
          }
        },
        { settle: prefersReducedMotion() },
      );
      force.current = handleOfRun;
      return () => {
        handleOfRun.stop();
        simulating.current = false;
      };
    }

    const { hive: options, hops: distances, selectedId: focus } = latest.current;
    const result = kind === "hive" ? hiveLayout(sc.nodes, options, distances) : kind === "circle" ? circleLayout(sc.nodes) : radialLayout(sc.nodes, sc.links, focus);
    staticLayout.current = result;
    angles.current = result.axisAngle.size > 0 ? Float64Array.from(sc.nodes, (n) => result.axisAngle.get(n.id) ?? NaN) : undefined;
    setCaption(result.caption);
    const fromX = Float64Array.from(geo.x);
    const fromY = Float64Array.from(geo.y);
    const toX = Float64Array.from(sc.nodes, (n, i) => result.positions.get(n.id)?.x ?? fromX[i]);
    const toY = Float64Array.from(sc.nodes, (n, i) => result.positions.get(n.id)?.y ?? fromY[i]);
    cancelMotion.current = animate(
      MORPH_MS,
      (p) => {
        const current = geometry.current;
        if (current.x.length !== toX.length) {
          return;
        }
        for (let i = 0; i < toX.length; i++) {
          current.x[i] = fromX[i] + (toX[i] - fromX[i]) * p;
          current.y[i] = fromY[i] + (toY[i] - fromY[i]) * p;
        }
        gridStale.current = true;
        requestDraw();
      },
      () => autoFit.current && fit(),
    );
    return () => cancelMotion.current();
    // The layout is computed from the latest props - the key says when that has to happen again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, scene.structure, hiveKey, arrangedBy, fit, requestDraw]);

  useEffect(() => {
    // A new representation or a first graph shows everything
    autoFit.current = true;
  }, [layout]);

  // Whatever the state says is painted - after every change of it
  useEffect(() => {
    requestDraw();
  }, [scene, selectedId, hovered, showLabels, showLinkLabels, showArrows, layout, requestDraw]);

  useEffect(
    () => () => {
      force.current?.stop();
      cancelMotion.current();
      cancelFit.current();
      // Reset as well: React may run the effects again after this (StrictMode) and a pending id would block all painting
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      window.clearTimeout(gestureTimer.current);
    },
    [],
  );

  // ---- Dragging nodes (network only) ----

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const worldOf = (x: number, y: number): [number, number] => {
      const t = transformRef.current;
      return [(x - t.x) / t.k, (y - t.y) / t.k];
    };
    const behavior = drag<HTMLCanvasElement, unknown, DragSubject>()
      .container(() => canvas)
      .filter((event: Event) => latest.current.layout === "network" && (!(event instanceof MouseEvent) || !event.button))
      .subject((event) => {
        const hit = hitAt(event.x, event.y);
        if (!hit || hit.badge) {
          return undefined as unknown as DragSubject; // not on a node: the press pans the view
        }
        const t = transformRef.current;
        const geo = geometry.current;
        return { x: t.applyX(geo.x[hit.index]), y: t.applyY(geo.y[hit.index]), index: hit.index };
      })
      .on("start", (event) => {
        hoverIndex.current = -1;
        setHover(undefined);
        autoFit.current = false;
        const [wx, wy] = worldOf(event.subject.x, event.subject.y);
        force.current?.pin(event.subject.index, wx, wy);
        force.current?.reheat(0.25);
        canvas.style.cursor = "";
        canvas.classList.add("is-dragging");
      })
      .on("drag", (event) => {
        const [wx, wy] = worldOf(event.x, event.y);
        const geo = geometry.current;
        const i = event.subject.index;
        if (i < geo.x.length) {
          geo.x[i] = wx;
          geo.y[i] = wy;
          gridStale.current = true;
        }
        force.current?.pin(i, wx, wy);
        gesture.current = true;
        requestDraw();
      })
      .on("end", (event) => {
        force.current?.release(event.subject.index);
        force.current?.reheat(0);
        gesture.current = false;
        canvas.classList.remove("is-dragging");
        requestDraw();
      });
    select(canvas).call(behavior);
    return () => {
      select(canvas).on(".drag", null);
    };
  }, [hitAt, requestDraw]);

  // ---- Pointer and keyboard ----

  const showHover = useCallback((index: number) => {
    const sc = latest.current.scene;
    const geo = geometry.current;
    const node = sc.nodes[index];
    if (!node || geo.x.length !== sc.nodes.length) {
      return;
    }
    const t = transformRef.current;
    setHover({ id: node.id, x: t.applyX(geo.x[index]), y: t.applyY(geo.y[index]) - (node.radius + 10) * t.k });
  }, []);

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.buttons) {
      return; // panning or dragging
    }
    const point = pointOf(event.nativeEvent, event.currentTarget);
    const hit = point && hitAt(point[0], point[1]);
    const index = hit ? hit.index : -1;
    event.currentTarget.style.cursor = hit ? "pointer" : "";
    if (index === hoverIndex.current) {
      return;
    }
    hoverIndex.current = index;
    if (index < 0) {
      setHover(undefined);
    } else {
      showHover(index);
    }
  };

  const onPointerLeave = () => {
    hoverIndex.current = -1;
    setHover(undefined);
  };

  const onClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = pointOf(event.nativeEvent, event.currentTarget);
    const hit = point && hitAt(point[0], point[1]);
    if (!hit) {
      onSelect(undefined);
      return;
    }
    const id = latest.current.scene.nodes[hit.index].id;
    if (hit.badge) {
      onExpand(id);
    } else {
      onSelect(id);
    }
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = pointOf(event.nativeEvent, event.currentTarget);
    const hit = point && hitAt(point[0], point[1]);
    const node = hit && latest.current.scene.nodes[hit.index];
    if (node && !hit.badge && node.status === "resolved") {
      onExpand(node.id);
    }
  };

  /** Moves the keyboard to a node: it is shown, named to screen readers and kept in view. */
  const moveCursorTo = (index: number) => {
    const sc = latest.current.scene;
    const geo = geometry.current;
    const node = sc.nodes[index];
    if (!node || geo.x.length !== sc.nodes.length) {
      return;
    }
    cursor.current = index;
    const t = transformRef.current;
    const { width, height } = size.current;
    const sx = t.applyX(geo.x[index]);
    const sy = t.applyY(geo.y[index]);
    const canvas = canvasRef.current;
    if (canvas && zoomRef.current && (sx < 40 || sy < 40 || sx > width - 40 || sy > height - 40)) {
      autoFit.current = false;
      zoomRef.current.translateTo(select(canvas), geo.x[index], geo.y[index]);
    }
    showHover(index);
    const linkCount = node.in + node.out;
    setAnnouncement(`${node.name}, ${node.status === "resolved" ? node.type : node.status === "restricted" ? "no access" : "not found"}, ${linkCount} link${linkCount === 1 ? "" : "s"}${node.expandable ? ", press E to load its links" : ""}`);
    requestDraw();
  };

  /** The nearest node in the direction - the keyboard follows what the eye sees. */
  const neighbourInDirection = (from: number, dx: number, dy: number): number => {
    const geo = geometry.current;
    const count = latest.current.scene.nodes.length;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < count; i++) {
      if (i === from) continue;
      const vx = geo.x[i] - geo.x[from];
      const vy = geo.y[i] - geo.y[from];
      const distance = Math.hypot(vx, vy);
      if (distance === 0) continue;
      const cos = (vx * dx + vy * dy) / distance;
      if (cos < 0.35) continue; // within about 70 degrees of the direction
      const score = distance * (2 - cos);
      if (score < bestScore) {
        best = i;
        bestScore = score;
      }
    }
    return best;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const sc = latest.current.scene;
    const directions: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const current = cursor.current >= 0 && cursor.current < sc.nodes.length ? cursor.current : -1;
    if (directions[event.key]) {
      event.preventDefault();
      if (current < 0) {
        moveCursorTo(sc.labelOrder[0] ?? -1);
        return;
      }
      const next = neighbourInDirection(current, directions[event.key][0], directions[event.key][1]);
      if (next >= 0) moveCursorTo(next);
      return;
    }
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (current >= 0) {
          if (event.shiftKey && sc.nodes[current].status === "resolved") onExpand(sc.nodes[current].id);
          else onSelect(sc.nodes[current].id);
        }
        break;
      case "e":
      case "E":
        if (current >= 0 && sc.nodes[current].status === "resolved") {
          event.preventDefault();
          onExpand(sc.nodes[current].id);
        }
        break;
      case "Escape":
        onSelect(undefined);
        hoverIndex.current = -1;
        setHover(undefined);
        break;
      case "Home":
        event.preventDefault();
        moveCursorTo(sc.labelOrder[0] ?? -1);
        break;
      case "+":
      case "=":
        event.preventDefault();
        zoomBy(1.4);
        break;
      case "-":
      case "_":
        event.preventDefault();
        zoomBy(1 / 1.4);
        break;
      case "0":
        event.preventDefault();
        autoFit.current = true;
        fit();
        break;
    }
  };

  const onFocus = () => {
    hasFocus.current = true;
    const sc = latest.current.scene;
    const selected = latest.current.selectedId ? sc.index.get(latest.current.selectedId) : undefined;
    if (cursor.current < 0 || cursor.current >= sc.nodes.length) {
      cursor.current = selected ?? sc.labelOrder[0] ?? -1;
    }
    requestDraw();
  };

  const onBlur = () => {
    hasFocus.current = false;
    hoverIndex.current = -1;
    setHover(undefined);
    requestDraw();
  };

  // ---- Rendering ----

  const hoveredNode = hovered ? scene.nodes[scene.index.get(hovered) ?? -1] : undefined;

  return (
    <div ref={containerRef} className="viz-canvas">
      <canvas
        ref={canvasRef}
        className="viz-surface"
        tabIndex={0}
        role="application"
        aria-roledescription="graph"
        aria-label={`Knowledge graph, ${nodes.length} instances and ${links.length} links`}
        aria-describedby={hintId}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <span id={hintId} className="visually-hidden">
        Use the arrow keys to move between instances. Enter selects, Shift and Enter or E shows its links, Escape clears the selection, plus and minus zoom, 0 shows everything.
      </span>
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>

      {caption && <div className="viz-caption">{caption}</div>}

      {hoveredNode && (
        <div className="viz-tooltip" style={{ left: hover?.x, top: hover?.y }} role="tooltip">
          <span className="viz-tooltip-type">
            <i style={{ background: hoveredNode.color }} />
            {hoveredNode.status === "resolved" ? hoveredNode.type : hoveredNode.status === "restricted" ? "No access" : "Not found"}
          </span>
          <strong>{hoveredNode.name}</strong>
          <span className="viz-tooltip-meta">
            {hoveredNode.out + hoveredNode.in} link{hoveredNode.out + hoveredNode.in === 1 ? "" : "s"} in the graph
            {hoveredNode.expandable ? " · double-click to expand" : ""}
          </span>
        </div>
      )}
    </div>
  );
});

export default GraphCanvas;
