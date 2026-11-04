import React, { useId, useLayoutEffect, useRef, useState } from "react";
import {
  LinkEdge,
  Point,
  linkEdges,
  readLinkEdgeInputs,
} from "./instanceLinkEdges";

interface InstanceLinkConnectorsProps {
  layout: HTMLDivElement | null;
}

type Graph = {
  width: number;
  height: number;
  edges: LinkEdge[];
  ports: Point[];
};

const EMPTY_GRAPH: Graph = { width: 0, height: 0, edges: [], ports: [] };

function roundPx(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Draws connectors between the open instance and its links.
 * Outgoing links leave the field they belong to and point at each type.
 * Incoming links point back at this instance, one for each linked instance.
 */
export default function InstanceLinkConnectors({
  layout,
}: InstanceLinkConnectorsProps) {
  const markerId = `link-arrow-${useId().replace(/:/g, "")}`;
  const [graph, setGraph] = useState<Graph>(EMPTY_GRAPH);
  const signature = useRef("");

  useLayoutEffect(() => {
    if (!layout) {
      return;
    }

    let frame = 0;
    const measure = () => {
      const rect = layout.getBoundingClientRect();
      const { edges, ports } = linkEdges(readLinkEdgeInputs(layout));
      const next: Graph = {
        width: roundPx(rect.width),
        height: roundPx(rect.height),
        edges,
        ports: ports.map((port) => ({ x: roundPx(port.x), y: roundPx(port.y) })),
      };
      const nextSignature = JSON.stringify(next);
      if (nextSignature === signature.current) {
        return;
      }
      signature.current = nextSignature;
      setGraph(next);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(layout);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(layout, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-link-highlighted", "data-link-hot", "data-link-color"],
    });
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [layout]);

  if (graph.edges.length === 0) {
    return null;
  }

  const hasActive = graph.edges.some((edge) => edge.active);

  return (
    <svg
      className="instance-link-connectors"
      width={graph.width}
      height={graph.height}
      aria-hidden="true"
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="context-stroke" />
        </marker>
      </defs>
      {graph.edges.map((edge) => (
        <path
          key={edge.id}
          d={edge.d}
          className={[
            "instance-link-edge",
            edge.active ? "is-active" : hasActive ? "is-dimmed" : "",
            edge.dashed ? "is-dashed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          markerEnd={`url(#${markerId})`}
          style={
            edge.active && edge.color
              ? ({ "--edge-color": edge.color } as React.CSSProperties)
              : undefined
          }
        />
      ))}
      {graph.ports.map((port) => (
        <circle
          key={`${port.x}:${port.y}`}
          className="instance-link-port"
          cx={port.x}
          cy={port.y}
          r="4.5"
        />
      ))}
    </svg>
  );
}
