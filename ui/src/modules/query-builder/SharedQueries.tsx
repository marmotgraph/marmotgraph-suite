import React, { useState } from "react";
import { Button, Col, Row, Table } from "react-bootstrap";
import Form from "react-bootstrap/Form";
import { useNavigate } from "react-router-dom";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faBookmark as faBookmarkSolid } from "@fortawesome/free-solid-svg-icons";
import { faBookmark as faBookmarkRegular } from "@fortawesome/free-regular-svg-icons";
import "./SharedQueries.css";

const mockQueries = [
  {
    id: 1,
    queryId: "47b94e45-5435-49a8-aba3-3d482fabced3",
    type: "Graph",
    title: "Network Traffic Analysis",
    description: "Query to analyze network traffic patterns and anomalies",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View, Edit",
    bookmarked: true
  },
  {
    id: 2,
    queryId: "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    type: "Table",
    title: "User Login Activity",
    description: "Track user authentication events and failed login attempts",
    space: "shared-workspace-a1b2c3d4",
    permissions: "View",
    bookmarked: false
  },
  {
    id: 3,
    queryId: "302a3695-722c-4e29-9543-8f6a7b8c9d0e",
    type: "Graph",
    title: "Asset Relationships",
    description: "Visualize connections between assets and dependencies",
    space: "private-302a3695-722c-4e29-9543-8f6a",
    permissions: "View, Edit, Share",
    bookmarked: true
  },
  {
    id: 4,
    queryId: "b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e",
    type: "Table",
    title: "Security Alerts Dashboard",
    description: "Comprehensive view of all security alerts and incidents",
    space: "team-security-ops",
    permissions: "View, Edit",
    bookmarked: false
  },
  {
    id: 5,
    queryId: "c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f",
    type: "Graph",
    title: "Service Dependencies",
    description: "",
    space: "private-25ae0198-753b-497d-9163-67488442f64",
    permissions: "View",
    bookmarked: true
  },
  {
    id: 6,
    queryId: "d4e5f6a7-b8c9-4d5e-0f1a-2b3c4d5e6f7a",
    type: "Table",
    title: "Compliance Report Q1",
    description: "Quarterly compliance metrics and audit results",
    space: "shared-compliance-workspace",
    permissions: "View, Edit, Delete",
    bookmarked: false
  },
  {
    id: 7,
    queryId: "7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    type: "Graph",
    title: "Data Flow Mapping",
    description: "Map data flows across systems and applications",
    space: "private-7f8e9d0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    permissions: "View, Edit",
    bookmarked: true
  },
  {
    id: 8,
    queryId: "e5f6a7b8-c9d0-4e5f-1a2b-3c4d5e6f7a8b",
    type: "Table",
    title: "Vulnerability Scan Results",
    description: "Latest vulnerability assessment findings and remediation status",
    space: "team-security-ops",
    permissions: "View",
    bookmarked: false
  }
];

export function SharedQueries() {
  const navigate = useNavigate();
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  const filteredQueries = showBookmarkedOnly
    ? mockQueries.filter((query) => query.bookmarked)
    : mockQueries;

  const handleRowClick = (queryId: string) => {
    navigate(`/queries/${queryId}`);
  };

  return (
    <div>
      <Form>
        <Row className="align-items-center">
          <Col className="col-md-11" xs="auto">
            <Form.Label htmlFor="inlineFormInput" visuallyHidden>
              Search query
            </Form.Label>
            <Form.Control
              id="inlineFormInput"
              placeholder="Search query"
            />
          </Col>
          <Col xs="auto">
            <Button className="btn-dark" type="submit">
              <FontAwesomeIcon icon={faMagnifyingGlass} size="xs" />
            </Button>
          </Col>
        </Row>
      </Form>
      <div className="row mt-3">
        <div className="col-12 mb-3">
          <Form.Check
            type="checkbox"
            id="bookmarked-filter"
            label="Show bookmarked only"
            checked={showBookmarkedOnly}
            onChange={(e) => setShowBookmarkedOnly(e.target.checked)}
          />
        </div>
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
              {filteredQueries.map((query) => (
                <tr
                  key={query.id}
                  onClick={() => handleRowClick(query.queryId)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <FontAwesomeIcon
                      icon={query.bookmarked ? faBookmarkSolid : faBookmarkRegular}
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
    </div>
  );
}
