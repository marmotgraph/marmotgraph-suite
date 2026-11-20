import React, { useEffect, useState } from "react";
import { Button, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnglesLeft,
  faAnglesRight,
  faArrowRight,
  faChevronDown,
  faChevronRight,
  faCircle,
  faCopy,
  faLinkSlash,
  faLock,
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
import LinksModal from "./LinksModal";
import "./InstanceLinksPanel.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

/** How many links of one type are shown before asking for more. */
export const LINKS_PAGE = 5;

/**
 * Up to this many links of one type can be revealed in the panel ("Show x more"). A type with more links is not
 * unfolded in the narrow panel - "Show all" lists them in a dialog.
 */
export const LINKS_INLINE_MAX = 10;

interface InstanceLinksPanelProps {
  links: LinkedInstance[];
  onLinkClick: (instanceId: string) => void;
  title: string;
  /** Whether the panel is reduced to a slim rail (on the side-by-side layout) */
  collapsed?: boolean;
  /** Collapses or expands the panel - the panel can't be collapsed without it */
  onToggleCollapsed?: () => void;
}

export default function InstanceLinksPanel({
  links,
  onLinkClick,
  title,
  collapsed,
  onToggleCollapsed,
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
      side="outgoing"
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      {Object.entries(groupedLinks).map(([fieldLabel, fieldLinks]) => (
        <FieldGroup
          key={fieldLabel}
          label={fieldLabel}
          section={fieldLabel}
          count={fieldLinks.length}
        >
          {groupByType(fieldLinks).map((typeLinks) => (
            <OutgoingTypeLinks
              key={
                typeLinks[0].linkStatus === "unresolved"
                  ? UNRESOLVED_TYPE
                  : typeLinks[0].type
              }
              fieldLabel={fieldLabel}
              typeLinks={typeLinks}
              onLinkClick={onLinkClick}
            />
          ))}
        </FieldGroup>
      ))}
    </LinksPanelFrame>
  );
}

/** The key the unresolved links are grouped by - their type is not known. */
const UNRESOLVED_TYPE = "\u0000unresolved";

/** One type of outgoing link. Only the first page is shown until the rest are requested. */
function OutgoingTypeLinks({
  fieldLabel,
  typeLinks,
  onLinkClick,
}: {
  fieldLabel: string;
  typeLinks: LinkedInstance[];
  onLinkClick: (instanceId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const first = typeLinks[0];
  const unresolved = first.linkStatus === "unresolved";
  const typeColor = first.typeColor || typeColors[first.type] || undefined;
  // Up to LINKS_INLINE_MAX links unfold in the panel - a type with more has them all in a dialog
  const many = typeLinks.length > LINKS_INLINE_MAX;
  const shown = expanded ? typeLinks : typeLinks.slice(0, LINKS_PAGE);
  const remaining = typeLinks.length - shown.length;

  return (
    <TypeGroup
      type={unresolved ? "Unknown type" : first.type}
      typeColor={typeColor}
      unresolved={unresolved}
      count={typeLinks.length}
      edge="outgoing"
      fieldLabel={fieldLabel}
    >
      {shown.map((link) => (
        <LinkItem
          key={link.instanceId}
          link={link}
          fieldLabel={fieldLabel}
          typeColor={typeColor}
          onLinkClick={onLinkClick}
        />
      ))}
      <LinksPageActions
        hasMore={remaining > 0 && !many}
        moreCount={remaining > 0 ? remaining : undefined}
        showAllLabel={many ? showAllLabel(typeLinks.length, first.type, unresolved) : undefined}
        showAllTitle={many ? `${showAllLabel(typeLinks.length, first.type, unresolved)} in ${fieldLabel}` : undefined}
        onShowAll={many ? () => setShowAll(true) : undefined}
        expanded={expanded}
        onMore={() => setExpanded(true)}
        onLess={() => setExpanded(false)}
      />
      {many && (
        <LinksModal
          show={showAll}
          onHide={() => setShowAll(false)}
          direction="outgoing"
          fieldLabel={fieldLabel}
          type={unresolved ? "Unknown type" : first.type}
          typeColor={typeColor}
          links={typeLinks}
          onLinkClick={onLinkClick}
        />
      )}
    </TypeGroup>
  );
}

/** The label of the link opening all links of a type - it names the type (a count is left out if it is not known). */
export function showAllLabel(count: number | undefined, type: string, unresolved = false) {
  const number = count !== undefined ? ` ${count}` : "";
  return unresolved ? `Show all${number} unknown connections` : `Show all${number} ${type} links`;
}

/**
 * Reveals the next page of a type, or returns to the first page. The count is omitted when it is not known.
 */
export function LinksPageActions({
  hasMore,
  moreCount,
  showAllLabel,
  showAllTitle,
  onShowAll,
  expanded,
  loading = false,
  onMore,
  onLess,
}: {
  hasMore: boolean;
  /** How many the next step reveals, when that number is known */
  moreCount?: number;
  /**
   * Set for a type with too many links to unfold in the panel: "Show all" opens them in a dialog - instead of
   * "Show more". The label names what is opened (e.g. "Show all 16 Person links") since several groups of links are
   * listed one below the other - the title adds the field they belong to.
   */
  onShowAll?: () => void;
  showAllLabel?: string;
  showAllTitle?: string;
  /** Whether more than the first page is visible */
  expanded: boolean;
  loading?: boolean;
  onMore: () => void;
  onLess: () => void;
}) {
  if (!hasMore && !expanded && !onShowAll) {
    return null;
  }
  return (
    <div className="links-page-actions">
      {onShowAll && (
        <Button
          variant="link"
          size="sm"
          className="links-load-more-btn"
          onClick={onShowAll}
          aria-haspopup="dialog"
          title={showAllTitle}
          aria-label={showAllTitle}
        >
          {showAllLabel ?? "Show all"}
        </Button>
      )}
      {hasMore && !onShowAll && (
        <Button
          variant="link"
          size="sm"
          className="links-load-more-btn"
          disabled={loading}
          onClick={onMore}
        >
          {loading ? (
            <>
              <Spinner
                animation="border"
                size="sm"
                role="status"
                className="me-2"
              />
              Loading...
            </>
          ) : moreCount !== undefined && moreCount > 0 ? (
            `Show ${moreCount} more`
          ) : (
            "Show more"
          )}
        </Button>
      )}
      {expanded && (
        <Button
          variant="link"
          size="sm"
          className="links-load-more-btn"
          onClick={onLess}
        >
          Show less
        </Button>
      )}
    </div>
  );
}

/** The links grouped by the type of the linked instance (in the order the types first occur). */
function groupByType(links: LinkedInstance[]) {
  const byType = new Map<string, LinkedInstance[]>();
  links.forEach((link) => {
    const type = link.linkStatus === "unresolved" ? UNRESOLVED_TYPE : link.type;
    byType.set(type, [...(byType.get(type) ?? []), link]);
  });
  return Array.from(byType.values());
}

/** Links of one type. The type names the cards under a property; it does not collapse them. */
export function TypeGroup({
  type,
  typeColor,
  unresolved = false,
  count,
  edge,
  fieldLabel,
  children,
}: {
  type: string;
  typeColor?: string;
  /** Whether the type is not known since the links could not be resolved */
  unresolved?: boolean;
  count: React.ReactNode;
  /** Outgoing groups get one connector for the whole type. */
  edge?: "outgoing";
  fieldLabel?: string;
  children: React.ReactNode;
}) {
  const connector = edge === "outgoing";
  return (
    <div
      className={`type-group${unresolved ? " type-group--unresolved" : ""}`}
      data-link-edge={connector ? "outgoing" : undefined}
      data-link-field={connector ? fieldLabel : undefined}
      data-link-type={connector ? type : undefined}
      data-link-color={connector ? typeColor : undefined}
      data-link-dashed={connector && unresolved ? "true" : undefined}
      style={
        typeColor
          ? ({ "--link-accent": typeColor } as React.CSSProperties)
          : undefined
      }
    >
      <div className="type-group-label">
        <FontAwesomeIcon
          icon={unresolved ? faLinkSlash : faCircle}
          className={unresolved ? "link-type-status-icon" : "link-type-icon"}
          data-link-handle={connector ? "" : undefined}
          aria-hidden={connector ? true : undefined}
          style={unresolved ? undefined : { color: typeColor || "#6c757d" }}
        />
        <span className="type-group-name">{type}</span>
        <span className="type-group-count">{count}</span>
      </div>
      {children}
    </div>
  );
}

/** Matches the stacked instance-detail layout. */
const NARROW_LAYOUT = "(max-width: 1199px)";

function useNarrowLayout() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(NARROW_LAYOUT);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

/** The panel the links are listed in - showing an empty state if there are none. */
export function LinksPanelFrame({
  title,
  count,
  isEmpty,
  emptyMessage,
  side,
  collapsed = false,
  onToggleCollapsed,
  children,
}: {
  title: string;
  /** The number of links - shown next to the title if given */
  count?: number;
  isEmpty: boolean;
  /** Shown instead of the default message if there are no links */
  emptyMessage?: React.ReactNode;
  /** The side of the instance the panel sits on - the arrow of the collapse button points to it */
  side?: "incoming" | "outgoing";
  /** On the side-by-side layout, the panel is reduced to a slim rail to give the instance more room */
  collapsed?: boolean;
  /** Collapses or expands the panel on the side-by-side layout - without it (and the side), the panel can't be collapsed there */
  onToggleCollapsed?: () => void;
  children: React.ReactNode;
}) {
  const narrow = useNarrowLayout();
  const [open, setOpen] = useState(false);
  const collapsible = !narrow && onToggleCollapsed !== undefined && side !== undefined;
  const showBody = narrow ? open : !(collapsible && collapsed);
  // The arrow points to the edge of the page when collapsing, and away from it when expanding
  const towardsEdge = side === "incoming" ? faAnglesLeft : faAnglesRight;
  const awayFromEdge = side === "incoming" ? faAnglesRight : faAnglesLeft;

  if (collapsible && collapsed) {
    return (
      <div className="links-rail-wrap">
        <div className="instance-links-panel is-rail">
          <Button
            variant="link"
            size="sm"
            className="links-panel-toggle"
            onClick={onToggleCollapsed}
            aria-expanded={false}
            aria-label={`Show ${title.toLowerCase()}`}
            title={`Show ${title.toLowerCase()}`}
          >
            <FontAwesomeIcon icon={awayFromEdge} />
          </Button>
          {count !== undefined && (
            <span
              className="links-rail-count"
              title={`${count} ${title.toLowerCase()}`}
            >
              {count}
            </span>
          )}
          <span className="links-rail-title">{title}</span>
        </div>
        {/* With links, the arrow shows their direction: incoming ones point to the instance, outgoing ones leave it.
            It sits outside the box, in the gap towards the instance - on the same side as the links, so it points
            right in either case. */}
        {count !== undefined && count > 0 && (
          <FontAwesomeIcon
            icon={faArrowRight}
            className={`links-rail-arrow links-rail-arrow--${side}`}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }
  return (
    <div className={`instance-links-panel${showBody ? "" : " is-closed"}`}>
      <div className="links-panel-header">
        <h3 className="links-panel-title">
          {title}
          {count !== undefined && (
            <span className="links-panel-count ms-1">({count})</span>
          )}
        </h3>
        {collapsible && (
          <Button
            variant="link"
            size="sm"
            className="links-panel-toggle"
            onClick={onToggleCollapsed}
            aria-expanded
            aria-label={`Hide ${title.toLowerCase()}`}
            title={`Hide ${title.toLowerCase()}`}
          >
            <FontAwesomeIcon icon={towardsEdge} />
          </Button>
        )}
        {narrow && (
          <Button
            variant="link"
            size="sm"
            className="links-panel-toggle"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            title={open ? "Hide links" : "Show links"}
          >
            <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} />
          </Button>
        )}
      </div>
      {showBody &&
        (isEmpty ? (
          <div className="links-empty-state">
            <p className="text-muted text-center mb-0">
              {emptyMessage ?? `No ${title.toLowerCase()}`}
            </p>
          </div>
        ) : (
          <div className="links-list">{children}</div>
        ))}
    </div>
  );
}

/** A (collapsible) group of links - labeled with the field they are linked by. */
export function FieldGroup({
  label,
  section,
  count,
  children,
}: {
  label: React.ReactNode;
  /** Field label this group should line up with in the open instance. */
  section?: string;
  count: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="field-group" data-link-field-group={section}>
      <button
        type="button"
        className="field-group-label"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        title={isCollapsed ? "Show links" : "Hide links"}
      >
        <FontAwesomeIcon
          icon={isCollapsed ? faChevronRight : faChevronDown}
          className="field-group-toggle-icon"
        />
        <span className="field-group-name">{label}</span>
        <span className="field-count">{count}</span>
      </button>
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
  edge,
  fieldLabel,
  typeColor,
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
  /** Which side of the open instance this card sits on, so a connector can be drawn */
  edge?: "incoming" | "outgoing";
  fieldLabel?: string;
  typeColor?: string;
}) {
  const resolved = isResolvedLink(link);
  const unresolved = link.linkStatus === "unresolved";
  const [hot, setHot] = useState(false);
  return (
    <div
      className={`link-item${
        resolved ? "" : ` link-item--${link.linkStatus}`
      }`}
      data-link-edge={edge}
      data-link-id={link.instanceId}
      data-link-field={fieldLabel}
      data-link-color={typeColor}
      data-link-dashed={unresolved ? "true" : undefined}
      data-link-hot={hot ? "true" : undefined}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onClick={resolved ? () => onLinkClick(link.instanceId) : undefined}
      title={linkedInstanceStatusDescription(link)}
      style={
        {
          ...(resolved ? { cursor: "pointer" } : {}),
          ...(typeColor ? { "--link-accent": typeColor } : {}),
        } as React.CSSProperties
      }
    >
      {edge && (
        <span
          className={`link-item-handle link-item-handle--${edge}`}
          data-link-handle=""
          aria-hidden="true"
        />
      )}
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
            className="link-id-copy"
            aria-label="Copy ID"
            title="Copy ID"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(link.instanceId);
            }}
          >
            <FontAwesomeIcon icon={faCopy} aria-hidden="true" />
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
        </div>
      )}
    </div>
  );
}
