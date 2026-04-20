import React, { useMemo, useState } from "react";
import { Col, Form, Row, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookmark as faBookmarkSolid,
  faCircle,
  faSort,
  faSortDown,
  faSortUp,
} from "@fortawesome/free-solid-svg-icons";
import { faBookmark as faBookmarkRegular } from "@fortawesome/free-regular-svg-icons";
import { mockInstances } from "./editorMockData";
import "../query-builder/SharedQueries.css";
import "./EditorHome.css";

type SortField = "type" | "instanceName" | "space";
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
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [spaceFilter, setSpaceFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Get unique types and spaces for filters
  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(mockInstances.map((i) => i.type))).sort();
  }, []);

  const uniqueSpaces = useMemo(() => {
    return Array.from(new Set(mockInstances.map((i) => i.space))).sort();
  }, []);

  // Filter and sort instances
  const filteredAndSortedInstances = useMemo(() => {
    let result = [...mockInstances];

    // Apply bookmarked filter
    if (showBookmarkedOnly) {
      result = result.filter((instance) => instance.bookmarked);
    }

    // Apply type filter
    if (typeFilter) {
      result = result.filter((instance) => instance.type === typeFilter);
    }

    // Apply space filter
    if (spaceFilter) {
      result = result.filter((instance) => instance.space === spaceFilter);
    }

    // Apply sorting
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        const aValue = a[sortField].toLowerCase();
        const bValue = b[sortField].toLowerCase();

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [showBookmarkedOnly, typeFilter, spaceFilter, sortField, sortDirection]);

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

      {/* Filters */}
      <Row className="mb-3">
        <Col md={3}>
          <Form.Check
            type="checkbox"
            id="bookmarked-filter-editor"
            label="Show bookmarked only"
            checked={showBookmarkedOnly}
            onChange={(e) => setShowBookmarkedOnly(e.target.checked)}
          />
        </Col>
        <Col md={3}>
          <Form.Select
            size="sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Select
            size="sm"
            value={spaceFilter}
            onChange={(e) => setSpaceFilter(e.target.value)}
          >
            <option value="">All Spaces</option>
            {uniqueSpaces.map((space) => (
              <option key={space} value={space}>
                {space}
              </option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      <div className="row">
        <div className="layout-content-bordless">
          <Table className="shared-queries-table" responsive="sm">
            <thead>
              <tr>
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
                <th
                  onClick={() => handleSort("space")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Saved in space {getSortIcon("space")}
                </th>
                <th>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedInstances.map((instance) => (
                <tr
                  key={instance.id}
                  onClick={() => handleRowClick(instance.instanceId)}
                  style={{ cursor: "pointer" }}
                >
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
                  <td>{instance.instanceName}</td>
                  <td>{instance.space}</td>
                  <td>{instance.permissions}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
