import React, { useCallback, useId } from "react";
import { Button, Modal, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/free-solid-svg-icons";
import { LinkedInstance } from "../modules/editor/editorMockData";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { LinkItem } from "./InstanceLinksPanel";
import "./InstanceLinksPanel.css";

type ModalLink = Pick<
  LinkedInstance,
  "instanceId" | "instanceName" | "space" | "linkStatus" | "hasDirectLinks" | "hasReverseLinks"
>;

/**
 * All the links of one type (by one field) in a dialog - for the groups with too many links to list in the panel.
 * The links are loaded as the list is scrolled if there are more than the ones given (incoming links are paginated).
 */
export default function LinksModal({
  show,
  onHide,
  direction,
  fieldLabel,
  type,
  typeColor,
  links,
  total,
  hasMore = false,
  loading = false,
  onLoadMore,
  onLinkClick,
}: {
  show: boolean;
  onHide: () => void;
  /** Whether the instances are linked by the open instance or link to it */
  direction: "outgoing" | "incoming";
  /** The field (or property) the links belong to */
  fieldLabel: string;
  type: string;
  typeColor?: string;
  /** The links loaded so far */
  links: ModalLink[];
  /** The number of all links of the type - if known */
  total?: number;
  /** Whether more links can be loaded */
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  onLinkClick: (instanceId: string) => void;
}) {
  const titleId = useId();
  const loadMore = useCallback(() => onLoadMore?.(), [onLoadMore]);
  const { rootRef, sentinelRef } = useInfiniteScroll<HTMLDivElement, HTMLDivElement>(
    show && hasMore && !loading && onLoadMore !== undefined,
    loadMore,
  );
  const count = total !== undefined && total > links.length ? `${links.length} of ${total}` : links.length;

  return (
    <Modal show={show} onHide={onHide} centered scrollable size="lg" className="links-modal" aria-labelledby={titleId}>
      <Modal.Header closeButton>
        <Modal.Title as="h2" id={titleId} className="links-modal-title">
          <span className="links-modal-kicker">
            {direction === "outgoing" ? "Outgoing links" : "Incoming links"} · {fieldLabel}
          </span>
          <span className="links-modal-heading">
            <FontAwesomeIcon icon={faCircle} className="link-type-icon" style={{ color: typeColor || "#6c757d" }} />
            {type}
            <span className="links-modal-count">{count}</span>
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body ref={rootRef}>
        <div className="links-list">
          {links.map((link) => (
            <LinkItem
              key={link.instanceId}
              link={link}
              typeColor={typeColor}
              onLinkClick={(instanceId) => {
                onHide();
                onLinkClick(instanceId);
              }}
            />
          ))}
        </div>
        {hasMore && (
          <div ref={sentinelRef} className="links-modal-more" role="status">
            {loading && (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Loading more...
              </>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
