import React, { useState } from "react";
import { Button, Modal, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark as faBookmarkSolid } from "@fortawesome/free-solid-svg-icons";
import { faBookmark as faBookmarkRegular } from "@fortawesome/free-regular-svg-icons";
import "./QueryHome.css";
import "./SharedQueries.css";

type EntityType = {
  name: string;
  url: string;
};

const mockTypes: EntityType[] = [
  { name: "Appliance", url: "https://kg.svc.cscs.ch/types/Appliance" },
  { name: "Asset Tag", url: "https://kg.svc.cscs.ch/types/AssetTag" },
  { name: "Blade", url: "https://kg.svc.cscs.ch/types/Blade" },
  { name: "Building", url: "https://kg.svc.cscs.ch/types/Building" },
  { name: "Cabinet", url: "https://kg.svc.cscs.ch/types/Cabinet" },
  { name: "Canton", url: "https://kg.svc.cscs.ch/types/Canton" },
];

const mockQueries = [
  {
    id: 1,
    queryId: "47b94e45-5435-49a8-aba3-3d482fabced3",
    type: "Graph",
    title: "Network Traffic Analysis",
    description: "Query to analyze network traffic patterns and anomalies",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View, Edit",
    bookmarked: true,
  },
  {
    id: 2,
    queryId: "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    type: "Table",
    title: "User Login Activity",
    description: "Track user authentication events and failed login attempts",
    space: "shared-workspace-a1b2c3d4",
    permissions: "View",
    bookmarked: false,
  },
  {
    id: 3,
    queryId: "302a3695-722c-4e29-9543-8f6a7b8c9d0e",
    type: "Graph",
    title: "Asset Relationships",
    description: "Visualize connections between assets and dependencies",
    space: "private-302a3695-722c-4e29-9543-8f6a",
    permissions: "View, Edit, Share",
    bookmarked: true,
  },
  {
    id: 4,
    queryId: "b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e",
    type: "Table",
    title: "Security Alerts Dashboard",
    description: "Comprehensive view of all security alerts and incidents",
    space: "team-security-ops",
    permissions: "View, Edit",
    bookmarked: false,
  },
  {
    id: 5,
    queryId: "c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f",
    type: "Graph",
    title: "Service Dependencies",
    description: "",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View",
    bookmarked: true,
  },
  {
    id: 6,
    queryId: "d4e5f6a7-b8c9-4d5e-0f1a-2b3c4d5e6f7a",
    type: "Table",
    title: "Compliance Report Q1",
    description: "Quarterly compliance metrics and audit results",
    space: "shared-compliance-workspace",
    permissions: "View, Edit, Delete",
    bookmarked: false,
  },
  {
    id: 7,
    queryId: "7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    type: "Graph",
    title: "Data Flow Mapping",
    description: "Map data flows across systems and applications",
    space: "private-7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    permissions: "View, Edit",
    bookmarked: true,
  },
  {
    id: 8,
    queryId: "e5f6a7b8-c9d0-4e5f-1a2b-3c4d5e6f7a8b",
    type: "Table",
    title: "Vulnerability Scan Results",
    description:
      "Latest vulnerability assessment findings and remediation status",
    space: "team-security-ops",
    permissions: "View",
    bookmarked: false,
  },
];

function TypeListFilter({
  types,
  onTypeSelect,
}: {
  types: EntityType[];
  onTypeSelect: (typeName: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);

  const filteredTypes = types.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const handleSelectType = (type: EntityType) => {
    setSelectedType(type);
    onTypeSelect(type.name);
  };

  return (
    <div>
      <input
        type="text"
        className="form-control mb-3"
        placeholder="Filter types..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className="list-group">
        {filteredTypes.length > 0 ? (
          filteredTypes.map((type) => (
            <li
              key={type.name}
              className={`list-group-item d-flex justify-content-between align-items-center ${
                selectedType?.name === type.name ? "active" : ""
              }`}
              style={{ cursor: "pointer" }}
              onClick={() => handleSelectType(type)}
            >
              <span className="fw-semibold">{type.name}</span>
              <a
                href={type.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline-secondary"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </a>
            </li>
          ))
        ) : (
          <li className="list-group-item text-muted">
            No types found matching "{filter}"
          </li>
        )}
      </ul>
      {selectedType && (
        <div className="mt-3 p-2 bg-light border rounded">
          <small className="text-muted">Selected: </small>
          <strong>{selectedType.name}</strong>
        </div>
      )}
    </div>
  );
}

export function QueryHome() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Filter bookmarked queries
  const bookmarkedQueries = mockQueries.filter((query) => query.bookmarked);

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedType(null);
  };

  const handleTypeSelection = (typeName: string) => {
    setSelectedType(typeName);
  };

  const handleCreateQuery = () => {
    if (selectedType) {
      // Generate a new query ID
      // TO DO: change with backend call
      const newQueryId = crypto.randomUUID();
      navigate(`/queries/${newQueryId}`);
      handleCloseModal();
    }
  };

  const handleRowClick = (queryId: string) => {
    navigate(`/queries/${queryId}`);
  };

  return (
    <div>
      <div className="mb-4">
        <h2>My Queries</h2>
      </div>

      <div className="row">
        <div className="layout-content-bordless">
          <Table className="shared-queries-table" responsive="sm">
            <thead>
              <tr>
                <th>Fav</th>
                <th>Type</th>
                <th>Title</th>
                <th>Description</th>
                <th>Saved in space</th>
                <th>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {bookmarkedQueries.map((query) => (
                <tr
                  key={query.id}
                  onClick={() => handleRowClick(query.queryId)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <FontAwesomeIcon
                      icon={
                        query.bookmarked ? faBookmarkSolid : faBookmarkRegular
                      }
                    />
                  </td>
                  <td>{query.type}</td>
                  <td>{query.title}</td>
                  <td>{query.description}</td>
                  <td>{query.space}</td>
                  <td>{query.permissions}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Modal for type selection */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create New Query</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label htmlFor="type-filter" className="form-label fw-bold">
              Select type
            </label>
          </div>
          <TypeListFilter
            types={mockTypes}
            onTypeSelect={handleTypeSelection}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button
            variant="dark"
            onClick={handleCreateQuery}
            disabled={!selectedType}
          >
            Create Query
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
