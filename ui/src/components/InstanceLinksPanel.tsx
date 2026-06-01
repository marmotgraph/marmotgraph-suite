import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faCircle,
  faCopy,
  faPencil,
} from "@fortawesome/free-solid-svg-icons";
import { LinkedInstance } from "../modules/editor/editorMockData";
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

interface InstanceLinksPanelProps {
  links: LinkedInstance[];
  onLinkClick: (instanceId: string) => void;
  title: string;
  isReverse?: boolean;
}

export default function InstanceLinksPanel({
  links,
  onLinkClick,
  title,
  isReverse = false,
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
                      fieldLinks.map((link, index) => {
                        const linkTypeColor =
                          typeColors[link.type] || "#6c757d";
                        return (
                          <div
                            key={link.instanceId}
                            className="link-item"
                            onClick={() => onLinkClick(link.instanceId)}
                            style={{ cursor: "pointer" }}
                          >
                            <div className="link-header">
                              <div className="link-type">
                                <FontAwesomeIcon
                                  icon={faCircle}
                                  className="link-type-icon"
                                  style={{ color: linkTypeColor }}
                                />
                                {link.type}
                              </div>
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
                            </div>
                            <div className="link-content">
                              <div className="link-name">
                                {link.instanceName}
                              </div>
                              <div className="link-meta">
                                <span className="link-id">
                                  ID: {link.instanceId}
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
                              <div className="link-space">
                                Space: {link.space}
                              </div>
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
