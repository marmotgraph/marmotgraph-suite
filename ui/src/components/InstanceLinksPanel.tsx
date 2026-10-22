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
  isReverse?: boolean;
  /** The link whose instance is highlighted */
  highlightedLink?: HoveredLink;
  /** Called with the link whose instance is hovered (undefined when left) */
  onLinkHover?: (link: HoveredLink | undefined) => void;
}

export default function InstanceLinksPanel({
  links,
  onLinkClick,
  title,
  isReverse = false,
  highlightedLink,
  onLinkHover,
}: InstanceLinksPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedFields, setCollapsedFields] = useState<Set<string>>(
    new Set(),
  );

  const toggleFieldCollapse = (fieldLabel: string) => {
    setCollapsedFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldLabel)) {
        newSet.delete(fieldLabel);
      } else {
        newSet.add(fieldLabel);
      }
      return newSet;
    });
  };

  // Group links by field label
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

  const getLinkStatusIcon = (link: LinkedInstance) => {
    if (isReverse) {
      // In the Reverse Links section, we're showing instances that link TO the current instance
      // The icon should show if there's a direct link from current instance to them (bidirectional)
      if (link.hasDirectLinks) {
        return DirLinkIcon; // Shows that there's also a direct link to this instance
      } else {
        return NoLinksIcon; // No direct link back, so it's unidirectional
      }
    } else {
      // In the Direct Links section, we're showing instances that the current instance links TO
      // The icon should only show if there's a reverse link back (bidirectional)
      if (link.hasReverseLinks) {
        return RevLinkIcon; // Shows that the linked instance points back
      } else {
        return NoLinksIcon; // No reverse link, so it's unidirectional
      }
    }
  };

  return (
    <div className={`instance-links-panel ${isCollapsed ? "collapsed" : ""}`}>
      <div className="links-panel-header">
        <h3 className="links-panel-title">{title}</h3>
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
          {!links || links.length === 0 ? (
            <div className="links-empty-state">
              <p className="text-muted text-center mb-0">
                No {title.toLowerCase()}
              </p>
            </div>
          ) : (
            <div className="links-list">
              {Object.entries(groupedLinks).map(([fieldLabel, fieldLinks]) => {
                const isFieldCollapsed = collapsedFields.has(fieldLabel);
                return (
                  <div key={fieldLabel} className="field-group">
                    <div
                      className="field-group-label"
                      onClick={() => toggleFieldCollapse(fieldLabel)}
                      style={{ cursor: "pointer" }}
                    >
                      <FontAwesomeIcon
                        icon={isFieldCollapsed ? faChevronRight : faChevronDown}
                        className="me-2"
                        style={{ fontSize: "0.7rem" }}
                      />
                      {fieldLabel}
                      <span className="field-count ms-2">
                        ({fieldLinks.length})
                      </span>
                    </div>
                    {!isFieldCollapsed &&
                      fieldLinks.map((link) => {
                        const linkTypeColor =
                          link.typeColor || typeColors[link.type] || "#6c757d";
                        const resolved = isResolvedLink(link);
                        const unresolved = link.linkStatus === "unresolved";
                        const highlighted =
                          highlightedLink?.fieldLabel === fieldLabel &&
                          highlightedLink.instanceId === link.instanceId;
                        return (
                          <div
                            key={link.instanceId}
                            className={`link-item${
                              resolved ? "" : ` link-item--${link.linkStatus}`
                            }${highlighted ? " link-item--highlighted" : ""}`}
                            onMouseEnter={
                              onLinkHover &&
                              (() =>
                                onLinkHover({
                                  fieldLabel,
                                  instanceId: link.instanceId,
                                }))
                            }
                            onMouseLeave={
                              onLinkHover && (() => onLinkHover(undefined))
                            }
                            onClick={
                              resolved
                                ? () => onLinkClick(link.instanceId)
                                : undefined
                            }
                            title={linkedInstanceStatusDescription(link)}
                            style={resolved ? { cursor: "pointer" } : undefined}
                          >
                            <div className="link-header">
                              <div className="link-type">
                                <FontAwesomeIcon
                                  icon={
                                    unresolved
                                      ? faLinkSlash
                                      : resolved
                                        ? faCircle
                                        : faLock
                                  }
                                  className={
                                    resolved
                                      ? "link-type-icon"
                                      : "link-type-status-icon"
                                  }
                                  style={
                                    unresolved
                                      ? undefined
                                      : { color: linkTypeColor }
                                  }
                                />
                                {unresolved ? "Unknown type" : link.type}
                              </div>
                              {resolved && (
                                <div className="d-flex align-items-center gap-2">
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
                            <div className="link-content">
                              <div className="link-name">
                                {linkedInstanceDisplayName(link)}
                              </div>
                              <div className="link-meta">
                                <span className="link-id">
                                  {unresolved ? "Identifier" : "ID"}:{" "}
                                  {link.instanceId}
                                </span>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 ms-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(
                                      link.instanceId,
                                    );
                                  }}
                                >
                                  <FontAwesomeIcon icon={faCopy} />
                                </Button>
                              </div>
                              {link.space && (
                                <div className="link-space">
                                  Space: {link.space}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
