import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Card, Badge, ListGroup } from "react-bootstrap";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faArrowRight, faChevronDown, faTriangleExclamation, faArrowUp, faArrowDown, faTrash } from "@fortawesome/free-solid-svg-icons";
import "./QueryHome.css";

const treeData = {
  type: "Appliance",
  url: "https://kg.svc.cscs.ch/types/Appliance",
  properties: [
    {
      id: 1,
      label: "identifier",
      type: "[ identifier ]",
      url: "$http://schema.org/id...",
    },
    {
      id: 2,
      label: "• @id",
      type: "",
      url: "",
    },
    {
      id: 3,
      label: "ip",
      type: "[ ip ]",
      url: "$https://kg.svc.cscs.ch/pro...",
    },
  ],
  relations: [
    {
      id: 4,
      label: "Asset tag",
      type: "[ assetTag ]",
      badge: "Asset Tag",
    },
  ],
};

const attributes = [
  { id: 1, name: "Component name", url: "https://kg.svc.cscs.ch/properties/componentName" },
  { id: 2, name: "Installation date", url: "https://kg.svc.cscs.ch/properties/installationDate" },
  { id: 3, name: "Inventory nr", url: "https://kg.svc.cscs.ch/properties/inventoryNr" },
  { id: 4, name: "Manufacture date", url: "https://kg.svc.cscs.ch/properties/manufactureDate" },
  { id: 5, name: "Name", url: "https://kg.svc.cscs.ch/properties/name" },
  { id: 6, name: "Nominal watts", url: "https://kg.svc.cscs.ch/properties/nominalWatts" },
  { id: 7, name: "Serial number", url: "https://kg.svc.cscs.ch/properties/serialNumber" },
  { id: 8, name: "Warranty expire date", url: "https://kg.svc.cscs.ch/properties/warrantyExpireDate" },
];

export function QueryDetail() {
  const { queryId } = useParams<{ queryId: string }>();
  const [selectedOption, setSelectedOption] = useState<string>("basic");

  const renderContent = () => {
    switch (selectedOption) {
      case "basic":
        return (
          <div>
            <Form>
              <Row className="align-items-center mt-4">
                <Col className="col-md-11" xs="auto">
                  <Form.Label htmlFor="inlineFormInput" visuallyHidden>
                    Search query
                  </Form.Label>
                  <Form.Control
                    id="inlineFormInput"
                    placeholder="Search query"
                  />
                </Col>
                <Col className="col-md-1" xs="auto">
                  <Button type="submit" className="query-home-submit-btn">
                    Submit
                  </Button>
                </Col>
              </Row>
            </Form>
            <div className="row mt-3">
              <div className="col-md-6">
                <div className="query-builder-panel">
                  <ListGroup variant="flush">
                    <ListGroup.Item className="tree-item-root">
                      <FontAwesomeIcon icon={faChevronDown} className="tree-toggle me-2" />
                      <FontAwesomeIcon icon={faCircle} className="tree-icon-circle me-2" />
                      <span className="tree-label">{treeData.type}</span>
                      <span className="tree-url ms-2">-{treeData.url}</span>
                    </ListGroup.Item>

                    {treeData.properties.map((prop) => (
                      <ListGroup.Item key={prop.id} className="tree-item-property">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="property-icon me-2" />
                        <span className="property-label">{prop.label}</span>
                        {prop.type && <span className="property-type ms-2">{prop.type}</span>}
                        {prop.url && <span className="property-url ms-2">( {prop.url} )</span>}
                        <div className="tree-actions ms-auto">
                          <Button size="sm" variant="light" className="action-btn">
                            <FontAwesomeIcon icon={faArrowUp} />
                          </Button>
                          <Button size="sm" variant="light" className="action-btn">
                            <FontAwesomeIcon icon={faArrowDown} />
                          </Button>
                          <Button size="sm" variant="light" className="action-btn">
                            <FontAwesomeIcon icon={faTrash} />
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}

                    {treeData.relations.map((rel) => (
                      <ListGroup.Item key={rel.id} className="tree-item-relation">
                        <FontAwesomeIcon icon={faChevronDown} className="tree-toggle me-2" />
                        <FontAwesomeIcon icon={faArrowRight} className="tree-icon-arrow me-2" />
                        <span className="tree-label">{rel.label}</span>
                        {rel.type && <span className="property-type ms-2">{rel.type}</span>}
                        {rel.badge && <Badge bg="secondary" className="ms-2">{rel.badge}</Badge>}
                        <div className="tree-actions ms-auto">
                          <Button size="sm" variant="light" className="action-btn">
                            <FontAwesomeIcon icon={faArrowUp} />
                          </Button>
                          <Button size="sm" variant="light" className="action-btn">
                            <FontAwesomeIcon icon={faArrowDown} />
                          </Button>
                          <Button size="sm" variant="light" className="action-btn">
                            <FontAwesomeIcon icon={faTrash} />
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              </div>
              <div className="col-md-6">
                <div className="query-builder-panel">
                  <h5 className="panel-title">Add to query</h5>
                  <p className="panel-subtitle">Select an item from the options below to be added to your query</p>

                  <div className="filter-section d-flex align-items-center gap-2 mb-3">
                    <Form.Control
                      type="text"
                      placeholder="Filter properties"
                      className="flex-grow-1"
                    />
                    <Button variant="dark" size="sm">
                      <FontAwesomeIcon icon={faCircle} />
                    </Button>
                    <Form.Check
                      type="checkbox"
                      label="Show advanced properties"
                    />
                  </div>

                  <h6 className="attributes-title">Attributes</h6>
                  <ListGroup variant="flush">
                    {attributes.map((attr) => (
                      <ListGroup.Item key={attr.id} className="attribute-item d-flex align-items-center">
                        <Button variant="outline-secondary" size="sm" className="add-btn me-3">
                          +
                        </Button>
                        <span className="attribute-label">{attr.name} - </span>
                        <span className="attribute-url ms-2">{attr.url}</span>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              </div>
            </div>
          </div>
        );
      case "advanced":
        return (
          <Card className="mt-4">
            <Card.Body>
              <h5>Advanced Query</h5>
              <p>
                Full-featured query builder with filters, joins, and
                aggregations.
              </p>
            </Card.Body>
          </Card>
        );
      case "custom":
        return (
          <Card className="mt-4">
            <Card.Body>
              <h5>Custom Query</h5>
              <p>Write raw SQL or custom query expressions.</p>
            </Card.Body>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-3">
        <small className="text-muted">Query ID: {queryId}</small>
      </div>

      {/* Button Group (acts like radio buttons) */}
      <div className="btn-group query-home-btn-group" role="group">
        <Button
          onClick={() => setSelectedOption("basic")}
          className={`btn-sm ${selectedOption === "basic" ? "active" : ""}`}
        >
          Basic Query
        </Button>
        <Button
          onClick={() => setSelectedOption("advanced")}
          className={`btn-sm ${selectedOption === "advanced" ? "active" : ""}`}
        >
          Advanced Query
        </Button>
        <Button
          onClick={() => setSelectedOption("custom")}
          className={`btn-sm ${selectedOption === "custom" ? "active" : ""}`}
        >
          Custom Query
        </Button>
      </div>

      {/* Dynamic content below */}
      {renderContent()}
    </div>
  );
}
