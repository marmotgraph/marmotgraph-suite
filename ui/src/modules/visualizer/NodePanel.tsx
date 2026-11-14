import React, { useMemo, useState } from "react";
import { Button, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, ExternalLink, GitFork, Lock, CircleHelp, X, EyeOff } from "lucide-react";
import { InstanceStatusTags } from "../../components/InstanceStatusTags";
import type { Degrees, Graph, GraphNode, Neighbour } from "./graphModel";
import { neighboursOf } from "./graphModel";

const PREVIEW = 6;

interface NodePanelProps {
  graph: Graph;
  node: GraphNode;
  degree?: Degrees;
  /** Whether details are being fetched for the node */
  loading: boolean;
  /** Whether the links are being loaded */
  expanding: boolean;
  /** How many instances linking to this one are not in the graph yet */
  pendingIncoming: number;
  onSelect: (id: string) => void;
  onExpand: (id: string) => void;
  onLoadMoreIncoming: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

function CopyId({ id }: Readonly<{ id: string }>) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="link"
      size="sm"
      className="edit-icon-btn viz-copy"
      aria-label={copied ? "Id copied" : "Copy id"}
      title={copied ? "Copied" : "Copy id"}
      onClick={() => {
        navigator.clipboard?.writeText(id);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </Button>
  );
}

/** One kind of neighbours (e.g. the datasets this instance links to) - the first few, the rest on demand. */
function NeighbourGroup({ type, color, items, onSelect }: Readonly<{ type: string; color: string; items: Neighbour[]; onSelect: (id: string) => void }>) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <div className="viz-neighbour-group">
      <div className="viz-neighbour-group-header">
        <span className="viz-dot" style={{ background: color }} aria-hidden="true" />
        <span className="viz-neighbour-type">{type}</span>
        <span className="viz-count">{items.length}</span>
      </div>
      <ul>
        {shown.map(({ node, labels }) => (
          <li key={node.id}>
            <button type="button" className="viz-neighbour" onClick={() => onSelect(node.id)} title={node.id}>
              <span className="viz-neighbour-name">{node.name}</span>
              {labels.length > 0 && <span className="viz-neighbour-via">{labels.join(", ")}</span>}
            </button>
          </li>
        ))}
      </ul>
      {items.length > PREVIEW && (
        <Button variant="link" size="sm" className="viz-more" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${items.length}`}
        </Button>
      )}
    </div>
  );
}

function Neighbours({ title, icon, items, onSelect }: Readonly<{ title: string; icon: React.ReactNode; items: Neighbour[]; onSelect: (id: string) => void }>) {
  const groups = useMemo(() => {
    const byType = new Map<string, { color: string; items: Neighbour[] }>();
    items.forEach((item) => {
      const key = item.node.status === "resolved" ? item.node.type : item.node.status === "restricted" ? "Restricted" : "Unknown";
      const group = byType.get(key) ?? { color: item.node.color, items: [] };
      group.items.push(item);
      byType.set(key, group);
    });
    return [...byType.entries()].sort((a, b) => b[1].items.length - a[1].items.length || a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <section className="viz-section" aria-label={title}>
      <h3 className="viz-kicker">
        {icon}
        {title} ({items.length})
      </h3>
      {groups.length === 0 ? (
        <p className="viz-muted">None in the graph.</p>
      ) : (
        groups.map(([type, group]) => <NeighbourGroup key={type} type={type} color={group.color} items={group.items} onSelect={onSelect} />)
      )}
    </section>
  );
}

/** What is known about the selected instance, and what can be done with it in the graph. */
export default function NodePanel({ graph, node, degree, loading, expanding, pendingIncoming, onSelect, onExpand, onLoadMoreIncoming, onRemove, onClose }: Readonly<NodePanelProps>) {
  const neighbours = useMemo(() => neighboursOf(graph, node.id), [graph, node.id]);
  const outgoing = neighbours.filter((n) => n.outgoing);
  const incoming = neighbours.filter((n) => !n.outgoing);
  const ghost = node.status !== "resolved";
  const restricted = node.status === "restricted";
  const ghostIcon = restricted ? <Lock size={12} /> : <CircleHelp size={12} />;
  let kicker = node.type;
  if (restricted) {
    kicker = "No access";
  } else if (node.status === "unresolved") {
    kicker = "Not found";
  }

  return (
    <aside className="viz-node-panel" style={{ "--viz-type-color": node.color } as React.CSSProperties} aria-label="Selected instance">
      <header className="viz-node-panel-header">
        <div className="viz-kicker viz-node-kicker">
          {ghost ? ghostIcon : <span className="viz-dot" style={{ background: node.color }} aria-hidden="true" />}
          {kicker}
        </div>
        <Button variant="link" size="sm" className="edit-icon-btn" onClick={onClose} aria-label="Close panel" title="Close">
          <X size={16} />
        </Button>
      </header>

      <div className="viz-node-name">{node.name}</div>
      <div className="viz-node-id">
        <code title={node.id}>{node.id}</code>
        <CopyId id={node.id} />
      </div>
      {node.space && <div className="viz-muted">Saved in space {node.space}</div>}
      {node.releaseStatus && (
        <div className="mt-2">
          <InstanceStatusTags releaseStatus={node.releaseStatus} contributed={node.contributed} />
        </div>
      )}
      {ghost && (
        <p className="viz-muted mt-2">
          {node.status === "restricted" ? "This instance exists, but you are not allowed to read it." : "No instance is known for this identifier."}
        </p>
      )}

      {!ghost && (
        <div className="viz-actions">
          <Button variant="outline-dark" size="sm" onClick={() => onExpand(node.id)} disabled={expanding}>
            {expanding ? <Spinner animation="border" size="sm" role="status" className="me-2" /> : <GitFork size={14} className="me-2" />}
            {node.expanded ? "Refresh links" : "Show links"}
          </Button>
          <Link className="btn btn-outline-secondary btn-sm" to={`/editor/instances/${encodeURIComponent(node.id)}`}>
            <ExternalLink size={14} className="me-2" />
            Open in editor
          </Link>
        </div>
      )}

      <div className="viz-stats" aria-label="Links in the graph">
        <div>
          <strong>{degree?.out ?? 0}</strong>
          <span>outgoing</span>
        </div>
        <div>
          <strong>{degree?.in ?? 0}</strong>
          <span>incoming</span>
        </div>
      </div>

      {!ghost && (
        <section className="viz-section" aria-label="Properties">
          <h3 className="viz-kicker">Properties</h3>
          {node.properties && node.properties.length > 0 ? (
            <dl className="viz-properties">
              {node.properties.map((property) => (
                <React.Fragment key={property.label}>
                  <dt>{property.label}</dt>
                  <dd>{property.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : loading ? (
            <div className="viz-skeleton" aria-label="Loading properties">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <p className="viz-muted">No plain values.</p>
          )}
        </section>
      )}

      <Neighbours title="Outgoing links" icon={<ArrowUpRight size={13} />} items={outgoing} onSelect={onSelect} />
      <Neighbours title="Incoming links" icon={<ArrowDownLeft size={13} />} items={incoming} onSelect={onSelect} />
      {pendingIncoming > 0 && (
        <Button variant="link" size="sm" className="viz-more" onClick={() => onLoadMoreIncoming(node.id)} disabled={expanding}>
          Load more incoming ({pendingIncoming} not shown)
        </Button>
      )}

      <footer className="viz-node-panel-footer">
        <Button variant="link" size="sm" className="viz-quiet" onClick={() => onRemove(node.id)}>
          <EyeOff size={14} className="me-2" />
          Remove from graph
        </Button>
      </footer>
    </aside>
  );
}
