import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Col, Collapse, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faCircle,
  faClipboardCheck,
  faCode,
  faCopy,
  faEye,
  faFilter,
  faGlasses,
  faHourglassHalf,
  faPen,
  faPenToSquare,
  faRocket,
  faSort,
  faSortDown,
  faSortUp,
  faStar as faStarSolid,
  faUserPen,
  faXmark,
  IconDefinition
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useInstances } from "../../contexts/InstancesContext";
import { SearchBar } from "../../components/SearchBar";
import { InstanceFilterPanel } from "../../components/InstanceFilterPanel";
import { FilterPill } from "../../components/FilterPill";
import InstanceFieldControl from "../../components/InstanceFieldControl";
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from "../../hooks/useMediaQuery";
import { useTypes } from "../../hooks/useTypes";
import { useSpaces } from "../../hooks/useSpaces";
import { typeLabel } from "../../services/types";
import {
  fetchInstance,
  InstanceDetail,
  InstanceField,
  InstanceSortBy,
} from "../../services/instances";
import { Timestamp } from "../../components/Timestamp";
import { InstanceSummary, ReleaseStatus } from "./editorMockData";
import { ValidationStatus } from "../../components/InstanceValidation";
import { EDITOR_BREADCRUMB_TRAIL_KEY } from "./editorConstants";
import "../query-builder/SharedQueries.css";
import "./EditorHome.css";

const BREADCRUMB_TRAIL_STORAGE_KEY = EDITOR_BREADCRUMB_TRAIL_KEY;

type InstanceFilters = {
  types: string[];
  spaces: string[];
  permissions: string[];
  releaseStatuses: string[];
};


// The number of instances additionally rendered whenever the end of the list is scrolled into view
const PAGE_SIZE = 50;

// Type color mapping
const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

export default function EditorHome() {
  const navigate = useNavigate();
  // const location = useLocation();
  const {
    instances,
    total,
    loading,
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    spaceFilter,
    setSpaceFilter,
    favoritesOnly,
    setFavoritesOnly,
    contributedOnly,
    setContributedOnly,
    sort,
    setSort,
    toggleFavorite,
    deleteInstances,
  } = useInstances({ load: true });
  const types = useTypes();
  const spaces = useSpaces();
  const [searchQuery, setSearchQuery] = useState<string>(searchTerm);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [itemsToShow, setItemsToShow] = useState<number>(PAGE_SIZE);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(
    new Set(),
  );
  const [previewInstanceId, setPreviewInstanceId] = useState<string | null>(
    null,
  );
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(
    new Set(),
  );
  const isMobile = useMediaQuery(MOBILE_VIEWPORT_QUERY);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<
    Pick<InstanceFilters, "permissions" | "releaseStatuses">
  >({
    permissions: [],
    releaseStatuses: [],
  });
  // The type, space, favorites and contribution filters are applied by the backend (see InstancesContext) - the others on the client
  const filters: InstanceFilters = useMemo(
    () => ({ ...localFilters, types: typeFilter, spaces: spaceFilter }),
    [localFilters, typeFilter, spaceFilter],
  );
  const setFilters = ({ types, spaces, ...rest }: InstanceFilters) => {
    setLocalFilters(rest);
    setTypeFilter(types);
    setSpaceFilter(spaces);
  };
  const activeFilterCount =
    (favoritesOnly ? 1 : 0) +
    (contributedOnly ? 1 : 0) +
    filters.types.length +
    filters.spaces.length +
    filters.releaseStatuses.length;
  const clearFilters = () => {
    setFavoritesOnly(false);
    setContributedOnly(false);
    setFilters({
      types: [],
      spaces: [],
      permissions: [],
      releaseStatuses: [],
    });
  };

  // Reset items to show when filters or search change
  useEffect(() => {
    setItemsToShow(PAGE_SIZE);
  }, [searchTerm, filters, favoritesOnly, contributedOnly]);

  // Reset the instance breadcrumb trail when the user returns to the editor home so that each new navigation
  // session starts fresh.
  useEffect(() => {
    try {
      sessionStorage.removeItem(BREADCRUMB_TRAIL_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  // The types (filtered by their identifier) and spaces to filter by
  const availableTypes = useMemo(() => {
    return types
      .map((type) => ({
        name: typeLabel(type),
        url: type.identifier,
        description: type.description,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [types]);

  const availableSpaces = useMemo(() => {
    return Array.from(new Set(spaces.map((space) => space.identifier))).sort();
  }, [spaces]);

  // The search term, type, space, favorites and contribution filters as well as the sorting are applied by the
  // backend (see InstancesContext) - only the release status is filtered on the client
  const filteredAndSortedInstances = useMemo(() => {
    if (filters.releaseStatuses.length === 0) {
      return instances;
    }
    return instances.filter((instance) =>
      filters.releaseStatuses.includes(instance.releaseStatus),
    );
  }, [instances, filters]);

  // The total is reported by the service (the instances are paginated) - it doesn't reflect the filters applied on the
  // client, so only the loaded matches can be counted while any of them is active
  const clientFiltered = filters.releaseStatuses.length > 0;
  const resultCount = clientFiltered ? filteredAndSortedInstances.length : total;

  // Infinite scrolling: render more instances once the sentinel below the table becomes visible. The observer is
  // recreated after each increment so it fires again if the sentinel is still visible (e.g. the rows don't fill the
  // container yet).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasMore = !loading && itemsToShow < filteredAndSortedInstances.length;
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!hasMore || !sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setItemsToShow((prev) => prev + PAGE_SIZE);
        }
      },
      { root: scrollContainerRef.current, rootMargin: "0px 0px 200px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, itemsToShow]);

  const handleSearch = () => {
    setSearchTerm(searchQuery.trim());
  };

  const handleRemoveFilter = (
    filterType: keyof InstanceFilters,
    value: string,
  ) => {
    setFilters({
      ...filters,
      [filterType]: filters[filterType].filter((item) => item !== value),
    });
  };

  const handleSort = (field: InstanceSortBy) => {
    // Cycle through: asc -> desc -> none (the default order of the backend: by name)
    if (sort?.by !== field) {
      setSort({ by: field, direction: "ASC" });
    } else if (sort.direction === "ASC") {
      setSort({ by: field, direction: "DESC" });
    } else {
      setSort(null);
    }
  };

  const handleSelectInstance = (instanceId: string) => {
    setSelectedInstances((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(instanceId)) {
        newSet.delete(instanceId);
      } else {
        newSet.add(instanceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (
      selectedInstances.size ===
      filteredAndSortedInstances.slice(0, itemsToShow).length
    ) {
      setSelectedInstances(new Set());
    } else {
      const allIds = new Set(
        filteredAndSortedInstances
          .slice(0, itemsToShow)
          .map((inst) => inst.instanceId),
      );
      setSelectedInstances(allIds);
    }
  };

  const canDeleteSelected = () => {
    return Array.from(selectedInstances).every((id) => {
      const inst = instances.find((i) => i.instanceId === id);
      return (
        inst?.permissions.includes("Edit") ||
        inst?.permissions.includes("Release")
      );
    });
  };

  const handleDeleteClick = () => {
    if (selectedInstances.size > 0 && canDeleteSelected()) {
      setShowDeleteModal(true);
    }
  };

  const handleConfirmDelete = () => {
    deleteInstances(Array.from(selectedInstances));
    setSelectedInstances(new Set());
    setShowDeleteModal(false);
  };

  const getSortIcon = (field: InstanceSortBy) => {
    if (sort?.by !== field) {
      return <FontAwesomeIcon icon={faSort} className="ms-1 text-muted" />;
    }
    return (
      <FontAwesomeIcon
        icon={sort.direction === "ASC" ? faSortUp : faSortDown}
        className="ms-1"
      />
    );
  };

  const getAriaSort = (field: InstanceSortBy) => {
    if (sort?.by !== field) {
      return undefined;
    }
    return sort.direction === "ASC" ? "ascending" : "descending";
  };

  const handleToggleFavorite = (instanceId: string) => {
    toggleFavorite(instanceId).catch((e: unknown) =>
      console.error("Failed to change the favorite", e),
    );
  };

  const handleRowClick = (instanceId: string) => {
    setPreviewInstanceId(instanceId);
  };

  const handleRowDoubleClick = (
    event: React.MouseEvent,
    instanceId: string,
  ) => {
    if ((event.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    navigate(`/editor/instances/${instanceId}`);
  };

  const previewInstance = instances.find(
    (instance) => instance.instanceId === previewInstanceId,
  );

  useEffect(() => {
    if (
      previewInstanceId &&
      !filteredAndSortedInstances.some(
        (instance) => instance.instanceId === previewInstanceId,
      )
    ) {
      setPreviewInstanceId(null);
    }
  }, [filteredAndSortedInstances, previewInstanceId]);

  return (
    <div className="editor-home">
      <div className="mb-4">
        <h2>Instances</h2>
      </div>

      {/* Search Bar */}
      <Row className="mb-3">
        <Col md={6}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            placeholder="Search instance"
            ariaLabel="Search instances"
          />
        </Col>
      </Row>

      {/* Filters. On a phone they collapse into one button so the list stays in view. */}
      <Row className="mb-3">
        <Col>
          {isMobile ? (
            <Button
              type="button"
              variant={activeFilterCount > 0 ? "dark" : "outline-secondary"}
              size="sm"
              className="d-inline-flex align-items-center gap-2"
              onClick={() => setShowMobileFilters(true)}
              aria-haspopup="dialog"
            >
              <FontAwesomeIcon icon={faFilter} />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
          ) : (
            <div className="d-flex gap-3 align-items-center flex-wrap">
              <Form.Check
                type="checkbox"
                id="favorites-filter-editor"
                label="Show favorites only"
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
              />
              <Form.Check
                type="checkbox"
                id="contributed-filter-editor"
                label="Show my contributions only"
                checked={contributedOnly}
                onChange={(e) => setContributedOnly(e.target.checked)}
              />
              <InstanceFilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                availableTypes={availableTypes}
                availableSpaces={availableSpaces}
              />
            </div>
          )}
        </Col>
      </Row>

      {isMobile && (
        <Modal
          show={showMobileFilters}
          onHide={() => setShowMobileFilters(false)}
          centered
          scrollable
          fullscreen="md-down"
        >
          <Modal.Header closeButton>
            <Modal.Title>Filters</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Check
              type="checkbox"
              id="favorites-filter-editor"
              label="Show favorites only"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
              className="mb-2"
            />
            <Form.Check
              type="checkbox"
              id="contributed-filter-editor"
              label="Show my contributions only"
              checked={contributedOnly}
              onChange={(e) => setContributedOnly(e.target.checked)}
              className="mb-3"
            />
            <InstanceFilterPanel
              variant="stacked"
              filters={filters}
              onFiltersChange={setFilters}
              availableTypes={availableTypes}
              availableSpaces={availableSpaces}
            />
          </Modal.Body>
          <Modal.Footer className="d-flex justify-content-between">
            <Button
              variant="outline-danger"
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
            >
              Clear all
            </Button>
            <Button variant="dark" onClick={() => setShowMobileFilters(false)}>
              Done
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Active Filter Pills */}
      {(filters.types.length > 0 ||
        filters.spaces.length > 0 ||
        filters.releaseStatuses.length > 0) && (
        <Row className="mb-3">
          <Col>
            <div className="d-flex flex-wrap">
              {filters.types.map((type) => (
                <FilterPill
                  key={type}
                  label="Type"
                  value={
                    availableTypes.find((t) => t.url === type)?.name ?? type
                  }
                  title={
                    availableTypes.find((t) => t.url === type)?.description
                  }
                  onRemove={() => handleRemoveFilter("types", type)}
                />
              ))}
              {filters.spaces.map((space) => (
                <FilterPill
                  key={space}
                  label="Space"
                  value={space}
                  onRemove={() => handleRemoveFilter("spaces", space)}
                />
              ))}
              {filters.releaseStatuses.map((status) => (
                <FilterPill
                  key={status}
                  label="Status"
                  value={status}
                  onRemove={() => handleRemoveFilter("releaseStatuses", status)}
                />
              ))}
            </div>
          </Col>
        </Row>
      )}

      {selectedInstances.size > 0 && (
        <div className="bulk-actions-bar">
          <div className="d-flex align-items-center justify-content-between">
            <span className="text-muted">
              {selectedInstances.size} instance
              {selectedInstances.size !== 1 ? "s" : ""} selected
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteClick}
              disabled={!canDeleteSelected()}
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {isMobile && (
        <div className="instance-card-toolbar">
          <Form.Check
            type="checkbox"
            id="select-all-instances"
            label="Select all"
            checked={
              selectedInstances.size ===
                filteredAndSortedInstances.slice(0, itemsToShow).length &&
              selectedInstances.size > 0
            }
            onChange={handleSelectAll}
            disabled={loading || filteredAndSortedInstances.length === 0}
          />
          <div
            className="instance-card-sort"
            role="group"
            aria-label="Sort instances"
          >
            {(
              [
                ["TYPE", "Type"],
                ["NAME", "Name"],
                ["LAST_MODIFICATION", "Last modified"],
              ] as const
            ).map(([field, label]) => (
              <Button
                key={field}
                type="button"
                size="sm"
                variant={sort?.by === field ? "dark" : "outline-secondary"}
                onClick={() => handleSort(field)}
              >
                {label}
                {getSortIcon(field)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="instances-result-count text-muted small">
        {!loading &&
          `${resultCount} result${resultCount !== 1 ? "s" : ""}`}
      </div>

      {/* The table takes the remaining height of the page and only scrolls its body (the header is sticky) */}
      <div className="editor-home-body">
        <div className="table-scroll-container" ref={scrollContainerRef}>
          {isMobile ? (
            <InstanceCardList
              instances={filteredAndSortedInstances.slice(0, itemsToShow)}
              loading={loading}
              selectedInstances={selectedInstances}
              previewInstanceId={previewInstance?.instanceId}
              expandedIds={expandedCardIds}
              copiedId={copiedId}
              onOpen={handleRowClick}
              onOpenDetail={handleRowDoubleClick}
              onToggleSelected={handleSelectInstance}
              onToggleFavorite={handleToggleFavorite}
              onToggleDetails={(instanceId) =>
                setExpandedCardIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(instanceId)) {
                    next.delete(instanceId);
                  } else {
                    next.add(instanceId);
                  }
                  return next;
                })
              }
              onCopyId={(instanceId) => {
                navigator.clipboard.writeText(instanceId);
                setCopiedId(instanceId);
                setTimeout(() => setCopiedId(null), 2000);
              }}
            />
          ) : (
            <Table className="shared-queries-table instances-table" striped>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <Form.Check
                      type="checkbox"
                      checked={
                        selectedInstances.size ===
                          filteredAndSortedInstances.slice(0, itemsToShow)
                            .length && selectedInstances.size > 0
                      }
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Fav</th>
                  <th
                    onClick={() => handleSort("TYPE")}
                    aria-sort={getAriaSort("TYPE")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Type {getSortIcon("TYPE")}
                  </th>
                  <th
                    onClick={() => handleSort("NAME")}
                    aria-sort={getAriaSort("NAME")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Instance Name {getSortIcon("NAME")}
                  </th>
                  <th>Permissions</th>
                  <th
                    onClick={() => handleSort("LAST_MODIFICATION")}
                    aria-sort={getAriaSort("LAST_MODIFICATION")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Last modified {getSortIcon("LAST_MODIFICATION")}
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <Spinner
                        animation="border"
                        size="sm"
                        role="status"
                        className="me-2"
                      />
                      Loading instances...
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredAndSortedInstances
                    .slice(0, itemsToShow)
                    .map((instance) => (
                      <tr
                        key={instance.id}
                        className={
                          previewInstance?.instanceId === instance.instanceId
                            ? "instance-row-selected"
                            : undefined
                        }
                        onClick={(e) => {
                          // Don't open the preview when clicking the checkbox
                          if (
                            (e.target as HTMLElement).closest(
                              'input[type="checkbox"]',
                            )
                          ) {
                            return;
                          }
                          handleRowClick(instance.instanceId);
                        }}
                        onDoubleClick={(e) =>
                          handleRowDoubleClick(e, instance.instanceId)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <Form.Check
                            type="checkbox"
                            checked={selectedInstances.has(instance.instanceId)}
                            onChange={() =>
                              handleSelectInstance(instance.instanceId)
                            }
                          />
                        </td>
                        <td>
                          <FavoriteToggle
                            instance={instance}
                            onToggle={handleToggleFavorite}
                          />
                        </td>
                        <td title={instance.typeDescription}>
                          <FontAwesomeIcon
                            icon={faCircle}
                            className="type-color-icon me-2"
                            style={{
                              color:
                                instance.typeColor ||
                                typeColors[instance.type] ||
                                "#999",
                            }}
                          />
                          {instance.type}
                        </td>
                        <td>
                          <div>{instance.instanceName}</div>
                          <div className="instance-id-info">
                            <span className="instance-id-text">
                              {instance.instanceId}
                            </span>
                            <span
                              className="copy-id-wrapper"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(
                                  instance.instanceId,
                                );
                                setCopiedId(instance.instanceId);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                            >
                              <FontAwesomeIcon
                                icon={faCopy}
                                className="ms-2 copy-icon"
                              />
                              <span className="copy-id-tooltip">
                                {copiedId === instance.instanceId
                                  ? "ID copied!"
                                  : "Copy ID"}
                              </span>
                            </span>
                          </div>
                          <div className="instance-space-info">
                            Saved in space {instance.space}
                          </div>
                        </td>
                        <td>
                          {instance.permissions.includes("View") && (
                            <FontAwesomeIcon
                              icon={faGlasses}
                              className="me-2"
                              aria-label="View"
                            />
                          )}
                          {instance.permissions.includes("Edit") && (
                            <FontAwesomeIcon
                              icon={faPen}
                              className="me-2"
                              aria-label="Edit"
                            />
                          )}
                          {instance.permissions.includes("Review") && (
                            <FontAwesomeIcon
                              icon={faClipboardCheck}
                              className="me-2"
                              aria-label="Review"
                            />
                          )}
                          {instance.permissions.includes("Release") && (
                            <FontAwesomeIcon
                              icon={faRocket}
                              aria-label="Release"
                            />
                          )}
                        </td>
                        <td>
                          <Timestamp value={instance.lastModified} fallback="" />
                        </td>
                        <td>
                          <InstanceStatusTags instance={instance} />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </Table>
          )}
          {hasMore && (
            <div
              ref={loadMoreRef}
              className="text-center text-muted small py-2"
            >
              <Spinner animation="border" size="sm" className="me-2" />
              Loading more instances...
            </div>
          )}
        </div>
        {previewInstance && (
          <InstancePreview
            instance={previewInstance}
            onToggleFavorite={handleToggleFavorite}
            onClose={() => setPreviewInstanceId(null)}
            onOpen={() =>
              navigate(`/editor/instances/${previewInstance.instanceId}`)
            }
            onEdit={() =>
              navigate(`/editor/instances/${previewInstance.instanceId}?edit=1`)
            }
            onRaw={() =>
              navigate(`/editor/instances/${previewInstance.instanceId}?raw=1`)
            }
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete the following instance
            {selectedInstances.size !== 1 ? "s" : ""}?
          </p>
          <p className="text-muted small">
            Click on an instance to remove it from the deletion list.
          </p>
          <ul className="list-unstyled mb-0">
            {Array.from(selectedInstances).map((id) => {
              const inst = instances.find((i) => i.instanceId === id);
              return inst ? (
                <li
                  key={id}
                  className="delete-modal-item"
                  onClick={() => handleSelectInstance(id)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 12px",
                    marginBottom: "4px",
                    backgroundColor: "#f8f9fa",
                    border: "1px solid #dee2e6",
                    borderRadius: "4px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#e9ecef";
                    e.currentTarget.style.borderColor = "#adb5bd";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                    e.currentTarget.style.borderColor = "#dee2e6";
                  }}
                >
                  <strong>{inst.instanceName}</strong> ({inst.type})
                  <span className="ms-2 text-muted small">✕</span>
                </li>
              ) : null;
            })}
          </ul>
          {selectedInstances.size === 0 && (
            <p className="text-muted text-center mt-3 mb-0">
              No instances selected for deletion.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

const RELEASE_STATUS_TAGS: Record<
  ReleaseStatus,
  { modifier?: string; icon: IconDefinition }
> = {
  released: { modifier: "released", icon: faRocket },
  "has changed": { modifier: "changed", icon: faPenToSquare },
  "in progress": { icon: faHourglassHalf },
};

/**
 * The release status of the instance (and whether the user has contributed to it) followed by the compliance of the
 * instance per validation schema.
 */
function InstanceStatusTags({ instance }: { instance: InstanceSummary }) {
  const { modifier, icon } = RELEASE_STATUS_TAGS[instance.releaseStatus];
  return (
    <div className="instance-status">
      <span
        className={
          modifier
            ? `instance-card-status instance-card-status--${modifier}`
            : "instance-card-status"
        }
      >
        <FontAwesomeIcon icon={icon} className="me-1" />
        {instance.releaseStatus}
      </span>
      {instance.contributed && (
        <span className="instance-card-status" title="You have contributed to this instance">
          <FontAwesomeIcon icon={faUserPen} className="me-1" />
          my contribution
        </span>
      )}
      {instance.validation && instance.validation.length > 0 && (
        <div className="instance-validations">
          {instance.validation.map((validation) => (
            <ValidationStatus key={validation.name} validation={validation} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The star flagging an instance as favorite of the user - toggles the flag without opening the instance. */
function FavoriteToggle({
  instance,
  onToggle,
}: {
  instance: InstanceSummary;
  onToggle: (instanceId: string) => void;
}) {
  const label = instance.favorite
    ? `Remove ${instance.instanceName} from favorites`
    : `Add ${instance.instanceName} to favorites`;
  return (
    <button
      type="button"
      className={
        instance.favorite
          ? "favorite-toggle favorite-toggle--active"
          : "favorite-toggle"
      }
      aria-pressed={instance.favorite}
      aria-label={label}
      title={instance.favorite ? "Remove from favorites" : "Add to favorites"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(instance.instanceId);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <FontAwesomeIcon icon={instance.favorite ? faStarSolid : faStarRegular} />
    </button>
  );
}

const permissionItems = [
  { key: "View", icon: faGlasses },
  { key: "Edit", icon: faPen },
  { key: "Review", icon: faClipboardCheck },
  { key: "Release", icon: faRocket },
] as const;

function InstanceCardList({
  instances,
  loading,
  selectedInstances,
  previewInstanceId,
  expandedIds,
  copiedId,
  onOpen,
  onOpenDetail,
  onToggleSelected,
  onToggleFavorite,
  onToggleDetails,
  onCopyId,
}: {
  instances: InstanceSummary[];
  loading: boolean;
  selectedInstances: Set<string>;
  previewInstanceId?: string;
  expandedIds: Set<string>;
  copiedId: string | null;
  onOpen: (instanceId: string) => void;
  onOpenDetail: (event: React.MouseEvent, instanceId: string) => void;
  onToggleSelected: (instanceId: string) => void;
  onToggleFavorite: (instanceId: string) => void;
  onToggleDetails: (instanceId: string) => void;
  onCopyId: (instanceId: string) => void;
}) {
  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" role="status" className="me-2" />
        Loading instances...
      </div>
    );
  }

  return (
    <div className="instance-cards">
      {instances.map((instance) => {
        const typeColor =
          instance.typeColor || typeColors[instance.type] || "#999";
        const detailsOpen = expandedIds.has(instance.instanceId);
        const permissions = permissionItems.filter((item) =>
          instance.permissions.includes(item.key),
        );
        return (
          <article
            key={instance.id}
            className={
              previewInstanceId === instance.instanceId
                ? "instance-card instance-card-selected"
                : "instance-card"
            }
            aria-label={instance.instanceName}
            onClick={(event) => {
              if (
                (event.target as HTMLElement).closest('input[type="checkbox"]')
              ) {
                return;
              }
              onOpen(instance.instanceId);
            }}
            onDoubleClick={(event) => onOpenDetail(event, instance.instanceId)}
          >
            <div className="instance-card-main">
              <div onClick={(event) => event.stopPropagation()}>
                <Form.Check
                  type="checkbox"
                  aria-label={`Select ${instance.instanceName}`}
                  checked={selectedInstances.has(instance.instanceId)}
                  onChange={() => onToggleSelected(instance.instanceId)}
                />
              </div>
              <div className="instance-card-content">
                <div className="instance-card-kicker">
                  <span title={instance.typeDescription}>
                    <FontAwesomeIcon
                      icon={faCircle}
                      className="type-color-icon me-2"
                      style={{ color: typeColor }}
                    />
                    {instance.type}
                  </span>
                  <FavoriteToggle
                    instance={instance}
                    onToggle={onToggleFavorite}
                  />
                </div>
                <h3 className="instance-card-name">{instance.instanceName}</h3>
                <div className="instance-card-id">
                  <span
                    className="instance-card-id-text"
                    title={instance.instanceId}
                  >
                    {instance.instanceId}
                  </span>
                  <button
                    type="button"
                    className="instance-preview-copy"
                    aria-label={
                      copiedId === instance.instanceId ? "ID copied" : "Copy ID"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      onCopyId(instance.instanceId);
                    }}
                  >
                    <FontAwesomeIcon icon={faCopy} />
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="instance-card-details-toggle"
              aria-expanded={detailsOpen}
              onClick={(event) => {
                event.stopPropagation();
                onToggleDetails(instance.instanceId);
              }}
            >
              <FontAwesomeIcon
                icon={detailsOpen ? faChevronUp : faChevronDown}
                className="me-2"
              />
              {detailsOpen ? "Hide details" : "Details"}
            </button>
            {detailsOpen && (
              <div className="instance-card-details">
                <div>
                  <span className="instance-preview-meta-label">Status</span>
                  <InstanceStatusTags instance={instance} />
                </div>
                <div>
                  <span className="instance-preview-meta-label">Space</span>
                  {instance.space}
                </div>
                {permissions.length > 0 && (
                  <div className="instance-card-permissions">
                    {permissions.map((item) => (
                      <span key={item.key}>
                        <FontAwesomeIcon icon={item.icon} />
                        {item.key}
                      </span>
                    ))}
                  </div>
                )}
                <div>
                  <span className="instance-preview-meta-label">
                    Last modified
                  </span>
                  <Timestamp value={instance.lastModified} fallback="Unknown" />
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function InstancePreview({
  instance,
  onToggleFavorite,
  onClose,
  onOpen,
  onEdit,
  onRaw,
}: {
  instance: InstanceSummary;
  onToggleFavorite: (instanceId: string) => void;
  onClose: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onRaw: () => void;
}) {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const [detail, setDetail] = useState<InstanceDetail | undefined>();
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const typeColor =
    instance.typeColor || typeColors[instance.type] || "#6c757d";

  useEffect(() => {
    let cancelled = false;
    setFieldsLoading(true);
    setFieldsError(undefined);
    setDetail(undefined);
    getAccessToken()
      .then((token) => fetchInstance(token, instance.instanceId))
      .then((loaded) => {
        if (!cancelled) {
          setDetail(loaded);
          setFieldsLoading(false);
        }
      })
      .catch((e: unknown) => {
        console.error("Failed to load the instance preview", e);
        if (!cancelled) {
          setFieldsError(e instanceof Error ? e.message : String(e));
          setFieldsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instance.instanceId]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(instance.instanceId);
    setCopied(true);
  };

  const fields = detail?.fields ?? [];
  const supportedFields = fields.filter(
    (field) => field.kind !== "UNSUPPORTED",
  );
  const unsupportedFields = fields
    .filter((field) => field.kind === "UNSUPPORTED")
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <aside
      className="instance-preview"
      style={{ "--instance-type-color": typeColor } as React.CSSProperties}
      aria-label={`Preview of ${instance.instanceName}`}
    >
      <div className="instance-preview-header">
        <div className="instance-preview-toolbar">
          <FavoriteToggle instance={instance} onToggle={onToggleFavorite} />
          <button
            type="button"
            className="instance-preview-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div className="instance-preview-type" title={instance.typeDescription}>
          <FontAwesomeIcon
            icon={faCircle}
            className="type-color-icon me-2"
            style={{ color: typeColor }}
          />
          {instance.type}
        </div>
        <h3 className="instance-preview-name">{instance.instanceName}</h3>
        <div className="instance-preview-id">
          <span
            className="instance-preview-id-text"
            title={instance.instanceId}
          >
            {instance.instanceId}
          </span>
          <button
            type="button"
            className="instance-preview-copy"
            onClick={handleCopyId}
            aria-label={copied ? "ID copied" : "Copy ID"}
            title={copied ? "ID copied!" : "Copy ID"}
          >
            <FontAwesomeIcon icon={faCopy} />
          </button>
        </div>
        <div className="instance-preview-space">
          <span className="instance-preview-meta-label">Space</span>
          {instance.space}
        </div>
        <div
          className="instance-preview-actions"
          role="group"
          aria-label="Open instance"
        >
          <Button
            variant="dark"
            size="sm"
            onClick={onOpen}
            aria-label="Open instance"
          >
            <FontAwesomeIcon icon={faEye} />
            Open
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onEdit}
            aria-label="Edit instance"
          >
            <FontAwesomeIcon icon={faPen} />
            Edit
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onRaw}
            aria-label="Open instance in raw mode"
          >
            <FontAwesomeIcon icon={faCode} />
            Raw
          </Button>
        </div>
      </div>
      <div className="instance-preview-fields">
        {fieldsLoading && (
          <div className="instance-preview-fields-status text-muted">
            <Spinner
              animation="border"
              size="sm"
              role="status"
              className="me-2"
            />
            Loading fields...
          </div>
        )}
        {!fieldsLoading && fieldsError && (
          <p className="instance-preview-fields-status text-muted mb-0">
            The fields could not be loaded.
          </p>
        )}
        {!fieldsLoading && !fieldsError && fields.length === 0 && (
          <p className="instance-preview-fields-status text-muted mb-0">
            This instance has no fields.
          </p>
        )}
        {!fieldsLoading &&
          !fieldsError &&
          supportedFields.map((field) => (
            <PreviewField
              key={field.identifier}
              field={field}
              onInstanceClick={(linkedId) =>
                navigate(`/editor/instances/${linkedId}`)
              }
            />
          ))}
        {!fieldsLoading && !fieldsError && unsupportedFields.length > 0 && (
          <PreviewUnsupportedFields
            fields={unsupportedFields}
            onInstanceClick={(linkedId) =>
              navigate(`/editor/instances/${linkedId}`)
            }
          />
        )}
      </div>
    </aside>
  );
}

function PreviewField({
  field,
  onInstanceClick,
}: {
  field: InstanceField;
  onInstanceClick: (instanceId: string) => void;
}) {
  return (
    <div className="instance-preview-field">
      <div className="instance-preview-field-label" title={field.tooltip}>
        {field.label}
      </div>
      <InstanceFieldControl
        field={field}
        value={field.value ?? null}
        onChange={() => undefined}
        isEditMode={false}
        onInstanceClick={onInstanceClick}
      />
    </div>
  );
}

function PreviewUnsupportedFields({
  fields,
  onInstanceClick,
}: {
  fields: InstanceField[];
  onInstanceClick: (instanceId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="instance-preview-unsupported">
      <button
        type="button"
        className="instance-preview-unsupported-toggle"
        onClick={() => setIsExpanded((previous) => !previous)}
        aria-expanded={isExpanded}
      >
        Unsupported fields ({fields.length})
        <FontAwesomeIcon
          icon={isExpanded ? faChevronUp : faChevronDown}
          className="ms-2"
        />
      </button>
      <Collapse in={isExpanded}>
        <div>
          {fields.map((field) => (
            <PreviewField
              key={field.identifier}
              field={field}
              onInstanceClick={onInstanceClick}
            />
          ))}
        </div>
      </Collapse>
    </div>
  );
}
