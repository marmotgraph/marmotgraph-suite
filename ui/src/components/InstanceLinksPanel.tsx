import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faCircle,
  faCopy,
  faLinkSlash,
  faLock,
  faPencil,
} from "@fortawesome/free-solid-svg-icons";
import {
  isResolvedLink,
  LinkedInstance,
  linkedInstanceDisplayName,
  linkedInstanceStatusDescription,
} from "../modules/editor/editorMockData";
import DirLinkIcon from "../assets/icons/DirLink.svg";
import RevLinkIcon from "../assets/icons/RevLink.svg";
import RevDirLinkIcon from "../assets/icons/RevDirLink.svg";
import NoLinksIcon from "../assets/icons/NoLinks.svg";
import "./InstanceLinksPanel.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

/** A link to an instance - identified by the field it is linked by and the linked instance */
export type HoveredLink = { fieldLabel: string; instanceId: string };

interface InstanceLinksPanelProps {
  links: LinkedInstance[];
  onLinkClick: (instanceId: string) => void;
  title: string;
  /** The link whose instance is highlighted */
  highlightedLink?: HoveredLink;
  /** Called with the link whose instance is hovered (undefined when left) */
  onLinkHover?: (link: HoveredLink | undefined) => void;
}

export default function InstanceLinksPanel({
  links,
  onLinkClick,
  title,
  highlightedLink,
  onLinkHover,
}: InstanceLinksPanelProps) {
  // Group links by field label - and within a field by the type of the linked instance
  const groupedLinks = links.reduce(
    (acc, link) => {
      const field = (link.fieldLabel || "Unknown Field").trim();
      if (!acc[field]) {
        acc[field] = [];
      }
      acc[field].push(link);
      return acc;
    },
    {} as Record<string, LinkedInstance[]>,
  );

  return (
    <LinksPanelFrame
      title={title}
      count={links?.length}
      isEmpty={!links || links.length === 0}
    >
      {Object.entries(groupedLinks).map(([fieldLabel, fieldLinks]) => (
        <FieldGroup
          key={fieldLabel}
          label={fieldLabel}
          count={fieldLinks.length}
        >
          {groupByType(fieldLinks).map((typeLinks) => {
            const first = typeLinks[0];
            const unresolved = first.linkStatus === "unresolved";
            return (
              <TypeGroup
                key={unresolved ? UNRESOLVED_TYPE : first.type}
                type={unresolved ? "Unknown type" : first.type}
                typeColor={
                  first.typeColor || typeColors[first.type] || undefined
                }
                unresolved={unresolved}
                count={typeLinks.length}
              >
                {typeLinks.map((link) => (
                  <LinkItem
                    key={link.instanceId}
                    link={link}
                    onLinkClick={onLinkClick}
                    highlighted={
                      highlightedLink?.fieldLabel === fieldLabel &&
                      highlightedLink.instanceId === link.instanceId
                    }
                    onHover={
                      onLinkHover &&
                      ((hovered) =>
                        onLinkHover(
                          hovered
                            ? { fieldLabel, instanceId: link.instanceId }
                            : undefined,
                        ))
                    }
                  />
                ))}
              </TypeGroup>
            );
          })}
        </FieldGroup>
      ))}
    </LinksPanelFrame>
  );
}

/** The key the unresolved links are grouped by - their type is not known. */
const UNRESOLVED_TYPE = "\u0000unresolved";

/** The links grouped by the type of the linked instance (in the order the types first occur). */
function groupByType(links: LinkedInstance[]) {
  const byType = new Map<string, LinkedInstance[]>();
  links.forEach((link) => {
    const type = link.linkStatus === "unresolved" ? UNRESOLVED_TYPE : link.type;
    byType.set(type, [...(byType.get(type) ?? []), link]);
  });
  return Array.from(byType.values());
}

/** The (collapsible) links to the instances of a type - labeled with the type (and the number of links). */
export function TypeGroup({
  type,
  typeColor,
  unresolved = false,
  count,
  children,
}: {
  type: string;
  typeColor?: string;
  /** Whether the type is not known since the links could not be resolved */
  unresolved?: boolean;
  count: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="type-group">
      <div
        className="type-group-label"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: "pointer" }}
      >
        <FontAwesomeIcon
          icon={isCollapsed ? faChevronRight : faChevronDown}
          className="type-group-toggle-icon"
        />
        <FontAwesomeIcon
          icon={unresolved ? faLinkSlash : faCircle}
          className={unresolved ? "link-type-status-icon" : "link-type-icon"}
          style={unresolved ? undefined : { color: typeColor || "#6c757d" }}
        />
        {type}
        <span className="field-count">({count})</span>
      </div>
      {!isCollapsed && children}
    </div>
  );
}

/** The collapsible panel the links are listed in - showing an empty state if there are none. */
export function LinksPanelFrame({
  title,
  count,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  /** The number of links - shown next to the title if given */
  count?: number;
  isEmpty: boolean;
  /** Shown instead of the default message if there are no links */
  emptyMessage?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className={`instance-links-panel ${isCollapsed ? "collapsed" : ""}`}>
      <div className="links-panel-header">
        <h3 className="links-panel-title">
          {title}
          {count !== undefined && (
            <span className="links-panel-count ms-1">({count})</span>
          )}
        </h3>
        <Button
          variant="link"
          size="sm"
          className="collapse-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <FontAwesomeIcon
            icon={isCollapsed ? faChevronRight : faChevronDown}
          />
        </Button>
      </div>
      {!isCollapsed && (
        <>
          {isEmpty ? (
            <div className="links-empty-state">
              <p className="text-muted text-center mb-0">
                {emptyMessage ?? `No ${title.toLowerCase()}`}
              </p>
            </div>
          ) : (
            <div className="links-list">{children}</div>
          )}
        </>
      )}
    </div>
  );
}

/** A (collapsible) group of links - labeled with the field they are linked by. */
export function FieldGroup({
  label,
  count,
  children,
}: {
  label: React.ReactNode;
  count: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="field-group">
      <div
        className="field-group-label"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: "pointer" }}
      >
        <FontAwesomeIcon
          icon={isCollapsed ? faChevronRight : faChevronDown}
          className="me-2"
          style={{ fontSize: "0.7rem" }}
        />
        {label}
        <span className="field-count ms-2">({count})</span>
      </div>
      {!isCollapsed && children}
    </div>
  );
}

/**
 * Shows whether the linked instance has incoming and/or outgoing links itself. The backend sets them accordingly for
 * the links of the instance: the instances it links to have incoming links and the ones linking to it outgoing links.
 */
const getLinkStatusIcon = (
  link: Pick<LinkedInstance, "hasDirectLinks" | "hasReverseLinks">,
) => {
  if (link.hasDirectLinks && link.hasReverseLinks) {
    return RevDirLinkIcon;
  } else if (link.hasDirectLinks) {
    return DirLinkIcon;
  } else if (link.hasReverseLinks) {
    return RevLinkIcon;
  }
  return NoLinksIcon;
};

/** A linked instance - it can only be opened if it is resolved (its type is shown for the whole group of links). */
export function LinkItem({
  link,
  onLinkClick,
  highlighted = false,
  onHover,
}: {
  link: Pick<
    LinkedInstance,
    | "instanceId"
    | "instanceName"
    | "space"
    | "linkStatus"
    | "hasDirectLinks"
    | "hasReverseLinks"
  >;
  onLinkClick: (instanceId: string) => void;
  highlighted?: boolean;
  /** Called with true when the link is hovered and with false when it is left */
  onHover?: (hovered: boolean) => void;
}) {
  const resolved = isResolvedLink(link);
  const unresolved = link.linkStatus === "unresolved";
  return (
    <div
      className={`link-item${
        resolved ? "" : ` link-item--${link.linkStatus}`
      }${highlighted ? " link-item--highlighted" : ""}`}
      onMouseEnter={onHover && (() => onHover(true))}
      onMouseLeave={onHover && (() => onHover(false))}
      onClick={resolved ? () => onLinkClick(link.instanceId) : undefined}
      title={linkedInstanceStatusDescription(link)}
      style={resolved ? { cursor: "pointer" } : undefined}
    >
      <div className="link-content">
        <div className="link-name">
          {!resolved && (
            <FontAwesomeIcon
              icon={unresolved ? faLinkSlash : faLock}
              className="link-type-status-icon me-1"
            />
          )}
          {linkedInstanceDisplayName(link)}
        </div>
        <div className="link-meta">
          <span className="link-id">
            {unresolved ? "Identifier" : "ID"}: {link.instanceId}
          </span>
          <Button
            variant="link"
            size="sm"
            className="p-0 ms-2"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(link.instanceId);
            }}
          >
            <FontAwesomeIcon icon={faCopy} />
          </Button>
        </div>
        {link.space && <div className="link-space">Space: {link.space}</div>}
      </div>
      {resolved && (
        <div className="link-actions">
          <img
            src={getLinkStatusIcon(link)}
            alt="Link status"
            className="link-item-status-icon"
          />
          <Button
            variant="link"
            size="sm"
            className="link-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onLinkClick(link.instanceId);
            }}
            title="Edit instance"
          >
            <FontAwesomeIcon icon={faPencil} />
          </Button>
        </div>
      )}
    </div>
  );
}
