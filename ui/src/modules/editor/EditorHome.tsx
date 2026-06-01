import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, Form, Modal, Row, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookmark as faBookmarkSolid,
  faCircle,
  faClipboardCheck,
  faCopy,
  faGlasses,
  faPen,
  faRocket,
  faSort,
  faSortDown,
  faSortUp,
} from "@fortawesome/free-solid-svg-icons";
import { faBookmark as faBookmarkRegular } from "@fortawesome/free-regular-svg-icons";
import { useInstances } from "../../contexts/InstancesContext";
import { SearchBar } from "../../components/SearchBar";
import { InstanceFilterPanel } from "../../components/InstanceFilterPanel";
import { FilterPill } from "../../components/FilterPill";
import "../query-builder/SharedQueries.css";
import "./EditorHome.css";

type InstanceFilters = {
  types: string[];
  spaces: string[];
  permissions: string[];
  releaseStatuses: string[];
};

type SortField = "type" | "instanceName" | "space" | "lastVisited";
type SortDirection = "asc" | "desc" | null;

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
  const { instances, deleteInstances } = useInstances();
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>("lastVisited");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [itemsToShow, setItemsToShow] = useState<number>(10);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(
    new Set(),
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [filters, setFilters] = useState<InstanceFilters>({
    types: [],
    spaces: [],
    permissions: [],
    releaseStatuses: [],
  });

  // Reset items to show when filters or search change
  useEffect(() => {
    setItemsToShow(10);
  }, [activeSearchQuery, filters, showBookmarkedOnly]);

  // Get unique types and spaces for filters
  const availableTypes = useMemo(() => {
    return Array.from(new Set(instances.map((i) => i.type)))
      .sort()
      .map((type) => ({
        name: type,
        url: `https://kg.svc.cscs.ch/types/${type.replace(/\s+/g, "")}`,
      }));
  }, [instances]);

  const availableSpaces = useMemo(() => {
    return Array.from(new Set(instances.map((i) => i.space))).sort();
  }, [instances]);

  // Filter and sort instances
  const filteredAndSortedInstances = useMemo(() => {
    let result = [...instances];

    // Apply search filter
    if (activeSearchQuery) {
      const query = activeSearchQuery.toLowerCase();
      result = result.filter(
        (instance) =>
          instance.instanceName.toLowerCase().includes(query) ||
          instance.type.toLowerCase().includes(query) ||
          instance.space.toLowerCase().includes(query),
      );
    }

    // Apply bookmarked filter
    if (showBookmarkedOnly) {
      result = result.filter((instance) => instance.bookmarked);
    }

    // Apply type filters
    if (filters.types.length > 0) {
      result = result.filter((instance) =>
        filters.types.includes(instance.type),
      );
    }

    // Apply space filters
    if (filters.spaces.length > 0) {
      result = result.filter((instance) =>
        filters.spaces.includes(instance.space),
      );
    }

    // Apply release status filters
    if (filters.releaseStatuses.length > 0) {
      result = result.filter((instance) =>
        filters.releaseStatuses.includes(instance.releaseStatus),
      );
    }

    // Apply sorting
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let primaryCompare = 0;

        if (sortField === "lastVisited") {
          const aValue = a.lastVisited || "";
          const bValue = b.lastVisited || "";

          if (aValue < bValue)
            primaryCompare = sortDirection === "asc" ? -1 : 1;
          else if (aValue > bValue)
            primaryCompare = sortDirection === "asc" ? 1 : -1;
        } else {
          const aValue = a[sortField].toLowerCase();
          const bValue = b[sortField].toLowerCase();

          if (aValue < bValue)
            primaryCompare = sortDirection === "asc" ? -1 : 1;
          else if (aValue > bValue)
            primaryCompare = sortDirection === "asc" ? 1 : -1;
        }

        // If primary sort values are equal, sort alphabetically by instance name
        if (primaryCompare === 0) {
          const aName = a.instanceName.toLowerCase();
          const bName = b.instanceName.toLowerCase();
          if (aName < bName) return -1;
          if (aName > bName) return 1;
          return 0;
        }

        return primaryCompare;
      });
    }

    return result;
  }, [
    instances,
    activeSearchQuery,
    showBookmarkedOnly,
    filters,
    sortField,
    sortDirection,
  ]);

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
  };

  const handleRemoveFilter = (
    filterType: keyof InstanceFilters,
    value: string,
  ) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: prev[filterType].filter((item) => item !== value),
    }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <FontAwesomeIcon icon={faSort} className="ms-1 text-muted" />;
    }
    if (sortDirection === "asc") {
      return <FontAwesomeIcon icon={faSortUp} className="ms-1" />;
    }
    if (sortDirection === "desc") {
      return <FontAwesomeIcon icon={faSortDown} className="ms-1" />;
    }
    return <FontAwesomeIcon icon={faSort} className="ms-1 text-muted" />;
  };

  const handleRowClick = (instanceId: string) => {
    navigate(`/instances/${instanceId}`);
  };

  return (
    <div>
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

      {/* Filters */}
      <Row className="mb-3">
        <Col>
          <div className="d-flex gap-3 align-items-center flex-wrap">
            <Form.Check
              type="checkbox"
              id="bookmarked-filter-editor"
              label="Show bookmarked only"
              checked={showBookmarkedOnly}
              onChange={(e) => setShowBookmarkedOnly(e.target.checked)}
            />
            <InstanceFilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              availableTypes={availableTypes}
              availableSpaces={availableSpaces}
            />
          </div>
        </Col>
      </Row>

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
                  value={type}
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

      <div className="row">
        <div className="layout-content-bordless">
          <div className="table-scroll-container">
            <Table className="shared-queries-table" responsive="sm" striped>
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
                    onClick={() => handleSort("type")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Type {getSortIcon("type")}
                  </th>
                  <th
                    onClick={() => handleSort("instanceName")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Instance Name {getSortIcon("instanceName")}
                  </th>
                  <th>Permissions</th>
                  <th
                    onClick={() => handleSort("lastVisited")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Last visited {getSortIcon("lastVisited")}
                  </th>
                  <th>Release status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedInstances
                  .slice(0, itemsToShow)
                  .map((instance) => (
                    <tr
                      key={instance.id}
                      onClick={(e) => {
                        // Don't navigate if clicking checkbox
                        if (
                          (e.target as HTMLElement).closest(
                            'input[type="checkbox"]',
                          )
                        ) {
                          return;
                        }
                        handleRowClick(instance.instanceId);
                      }}
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
                        <FontAwesomeIcon
                          icon={
                            instance.bookmarked
                              ? faBookmarkSolid
                              : faBookmarkRegular
                          }
                        />
                      </td>
                      <td>
                        <FontAwesomeIcon
                          icon={faCircle}
                          className="type-color-icon me-2"
                          style={{ color: typeColors[instance.type] || "#999" }}
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
                            title="View"
                          />
                        )}
                        {instance.permissions.includes("Edit") && (
                          <FontAwesomeIcon
                            icon={faPen}
                            className="me-2"
                            title="Edit"
                          />
                        )}
                        {instance.permissions.includes("Review") && (
                          <FontAwesomeIcon
                            icon={faClipboardCheck}
                            className="me-2"
                            title="Review"
                          />
                        )}
                        {instance.permissions.includes("Release") && (
                          <FontAwesomeIcon icon={faRocket} title="Release" />
                        )}
                      </td>
                      <td>{instance.lastVisited || ""}</td>
                      <td>{instance.releaseStatus}</td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
          {itemsToShow < filteredAndSortedInstances.length && (
            <div className="text-center mt-3 mb-3">
              <Button
                variant="outline-secondary"
                onClick={() => setItemsToShow((prev) => prev + 10)}
              >
                Show More ({filteredAndSortedInstances.length - itemsToShow}{" "}
                remaining)
              </Button>
            </div>
          )}
        </div>
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
