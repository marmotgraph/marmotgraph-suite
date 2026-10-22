import React from "react";
import { Button, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/free-solid-svg-icons";
import { IncomingLinks, IncomingLinksOfType } from "../services/instances";
import { FieldGroup, LinkItem, LinksPanelFrame } from "./InstanceLinksPanel";
import "./InstanceLinksPanel.css";

interface IncomingLinksPanelProps {
  incomingLinks: IncomingLinks[];
  loading?: boolean;
  error?: string;
  onLinkClick: (instanceId: string) => void;
  /** Loads the following page of the instances of the type linking by the property */
  onLoadMore: (property: string, type: IncomingLinksOfType) => void;
  /** Whether the following page of the instances of the type linking by the property is being loaded */
  isLoadingMore: (property: string, typeIdentifier: string) => boolean;
}

/** The number of loaded instances of a type (of all of them if there are more). */
function count(loaded: number, total: number | undefined) {
  return total !== undefined && total > loaded
    ? `${loaded} of ${total}`
    : loaded;
}

/** The number of instances of the type linking by the property - the loaded ones if the total is not known. */
function total(type: IncomingLinksOfType) {
  return type.total ?? type.links.length;
}

/** The number of instances linking by the property (of any type). */
function groupTotal(group: IncomingLinks) {
  return group.types.reduce((n, t) => n + total(t), 0);
}

/** Whether there are more instances of the type linking by the property than loaded. */
function hasMore(type: IncomingLinksOfType) {
  return (
    Boolean(type.nextMarker) &&
    (type.total === undefined || type.links.length < type.total)
  );
}

/** The instances linking to an instance - grouped by the property they link with and their type. */
export default function IncomingLinksPanel({
  incomingLinks,
  loading = false,
  error,
  onLinkClick,
  onLoadMore,
  isLoadingMore,
}: IncomingLinksPanelProps) {
  const title = "Incoming Links";
  let emptyMessage: React.ReactNode = undefined;
  if (loading) {
    emptyMessage = (
      <>
        <Spinner animation="border" size="sm" role="status" className="me-2" />
        Loading incoming links...
      </>
    );
  } else if (error) {
    emptyMessage = error;
  }

  return (
    <LinksPanelFrame
      title={title}
      count={
        loading || error
          ? undefined
          : incomingLinks.reduce((n, g) => n + groupTotal(g), 0)
      }
      isEmpty={loading || incomingLinks.length === 0}
      emptyMessage={emptyMessage}
    >
      {incomingLinks.map((group) => (
        <FieldGroup
          key={group.property}
          label={<span title={group.property}>{group.label}</span>}
          count={groupTotal(group)}
        >
          {group.types.map((type) => {
            const loadingMore = isLoadingMore(
              group.property,
              type.typeIdentifier,
            );
            return (
              <div key={type.typeIdentifier} className="incoming-type-group">
                <div className="incoming-type-label">
                  <FontAwesomeIcon
                    icon={faCircle}
                    className="link-type-icon"
                    style={{ color: type.typeColor || "#6c757d" }}
                  />
                  {type.type}
                  <span className="field-count">
                    ({count(type.links.length, type.total)})
                  </span>
                </div>
                {type.links.map((link) => (
                  <LinkItem
                    key={link.instanceId}
                    link={link}
                    onLinkClick={onLinkClick}
                  />
                ))}
                {hasMore(type) && (
                  <Button
                    variant="link"
                    size="sm"
                    className="links-load-more-btn"
                    disabled={loadingMore}
                    onClick={() => onLoadMore(group.property, type)}
                  >
                    {loadingMore ? (
                      <>
                        <Spinner
                          animation="border"
                          size="sm"
                          role="status"
                          className="me-2"
                        />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </FieldGroup>
      ))}
    </LinksPanelFrame>
  );
}
