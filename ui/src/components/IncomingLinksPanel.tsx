import React, { useState } from "react";
import { Spinner } from "react-bootstrap";
import {
  INCOMING_LINKS_PAGE_SIZE,
  IncomingLinks,
  IncomingLinksOfType,
} from "../services/instances";
import {
  FieldGroup,
  LinkItem,
  LinksPageActions,
  LinksPanelFrame,
  TypeGroup,
} from "./InstanceLinksPanel";
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

/** One type of incoming link. Further pages stay loaded, and can be hidden again. */
function IncomingTypeLinks({
  groupLabel,
  property,
  type,
  loadingMore,
  onLinkClick,
  onLoadMore,
}: {
  groupLabel: string;
  property: string;
  type: IncomingLinksOfType;
  loadingMore: boolean;
  onLinkClick: (instanceId: string) => void;
  onLoadMore: (property: string, type: IncomingLinksOfType) => void;
}) {
  const [firstPage] = useState(() => type.links.length);
  const [limit, setLimit] = useState(firstPage);
  const shown = type.links.slice(0, limit);
  const hidden = type.links.length - shown.length;
  const pending =
    type.total !== undefined
      ? Math.max(0, type.total - type.links.length)
      : undefined;
  const canShowMore = hidden > 0 || hasMore(type);
  const moreCount =
    hidden > 0
      ? Math.min(INCOMING_LINKS_PAGE_SIZE, hidden)
      : pending !== undefined && pending > 0
        ? Math.min(INCOMING_LINKS_PAGE_SIZE, pending)
        : undefined;

  return (
    <TypeGroup
      type={type.type}
      typeColor={type.typeColor}
      count={count(type.links.length, type.total)}
    >
      {shown.map((link) => (
        <LinkItem
          key={link.instanceId}
          link={link}
          edge="incoming"
          fieldLabel={groupLabel}
          typeColor={type.typeColor}
          onLinkClick={onLinkClick}
        />
      ))}
      <LinksPageActions
        hasMore={canShowMore}
        moreCount={moreCount}
        expanded={shown.length > firstPage}
        loading={loadingMore}
        onMore={() => {
          setLimit((current) => current + INCOMING_LINKS_PAGE_SIZE);
          if (hidden === 0) {
            onLoadMore(property, type);
          }
        }}
        onLess={() => setLimit(firstPage)}
      />
    </TypeGroup>
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
          {group.types.map((type) => (
            <IncomingTypeLinks
              key={type.typeIdentifier}
              groupLabel={group.label}
              property={group.property}
              type={type}
              loadingMore={isLoadingMore(group.property, type.typeIdentifier)}
              onLinkClick={onLinkClick}
              onLoadMore={onLoadMore}
            />
          ))}
        </FieldGroup>
      ))}
    </LinksPanelFrame>
  );
}
