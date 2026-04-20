import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Form, Badge, Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faCopy, faPencil } from "@fortawesome/free-solid-svg-icons";
import { mockInstances } from "./editorMockData";
import "./InstanceDetail.css";

const typeColors: Record<string, string> = {
  "Appliance": "#ff9800",
  "Asset Tag": "#9c27b0",
  "Blade": "#2196f3",
  "Building": "#4caf50",
  "Cabinet": "#f44336",
  "Canton": "#00bcd4"
};

export default function InstanceDetail() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [isEditMode, setIsEditMode] = useState(false);

  // Find the instance by instanceId
  const instance = mockInstances.find(i => i.instanceId === instanceId);
  const typeColor = instance ? typeColors[instance.type] || "#6c757d" : "#6c757d";

  // Mock field values
  const [field1, setField1] = useState("Field value");
  const [field2, setField2] = useState("Field value");
  const [field3Values] = useState(["Field value 1", "Field value 2", "Field value 3", "Field value 4"]);
  const [field4Values] = useState(["Field value 1"]);
  const [field5Values] = useState(["Field value 1", "Field value 2", "Field value 3", "Field value 4"]);

  if (!instance) {
    return (
      <div>
        <h2>Instance not found</h2>
        <p>No instance found with ID: {instanceId}</p>
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(instanceId || "");
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleSave = () => {
    // Save logic would go here
    setIsEditMode(false);
  };

  const handleCancel = () => {
    // Reset logic would go here
    setIsEditMode(false);
  };

  const removeValue = (index: number, field: string) => {
    // Handle remove logic here
    console.log(`Remove value ${index} from ${field}`);
  };

  return (
    <div className="instance-detail-container">
      {/* Header Section */}
      <div className="instance-header">
        <div className="d-flex align-items-start justify-content-between">
          <div className="flex-grow-1">
            <div className="instance-type-label">
              <FontAwesomeIcon icon={faCircle} className="instance-type-color-icon me-2" style={{ color: typeColor }} />
              {instance.type}
            </div>
            <h2 className="instance-name">{instance.instanceName}</h2>
            <div className="instance-meta">
              <span className="me-3">
                <strong>ID:</strong> {instanceId}
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 ms-2"
                  onClick={handleCopyId}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </Button>
              </span>
              <span>
                <strong>Space:</strong> {instance.space}
              </span>
            </div>
          </div>
          {!isEditMode && (
            <Button
              variant="link"
              className="edit-icon-btn"
              onClick={handleEdit}
              aria-label="Edit"
              title="Edit"
            >
              <FontAwesomeIcon icon={faPencil} />
            </Button>
          )}
        </div>
      </div>

      {/* View/Edit Mode Content */}
      {!isEditMode ? (
        // View Mode
        <div className="instance-view">
          <div className="mb-4">
            <div className="view-label">Field 1</div>
            <div className="view-value">{field1}</div>
          </div>

          <div className="mb-4">
            <div className="view-label">Field 2</div>
            <div className="view-value">{field2}</div>
          </div>

          <div className="mb-4">
            <div className="view-label">Field 3</div>
            <div className="view-value">
              {field3Values.map((value, index) => (
                <Badge
                  key={index}
                  bg="light"
                  text="dark"
                  className="view-badge me-2 mb-2"
                >
                  {value}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="view-label">Field 4</div>
            <div className="view-value">
              {field4Values.map((value, index) => (
                <Badge
                  key={index}
                  bg="light"
                  text="dark"
                  className="view-badge me-2 mb-2"
                >
                  {value}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="view-label">Field 5</div>
            <div className="view-value">
              {field5Values.map((value, index) => (
                <Badge
                  key={index}
                  bg="light"
                  text="dark"
                  className="view-badge me-2 mb-2"
                >
                  {value}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Edit Mode
        <div className="instance-form">
          {/* Field 1 - Single text input */}
          <Form.Group className="mb-4">
            <Form.Label>Field 1</Form.Label>
            <Form.Control
              type="text"
              value={field1}
              onChange={(e) => setField1(e.target.value)}
            />
          </Form.Group>

          {/* Field 2 - Single text input */}
          <Form.Group className="mb-4">
            <Form.Label>Field 2</Form.Label>
            <Form.Control
              type="text"
              value={field2}
              onChange={(e) => setField2(e.target.value)}
            />
          </Form.Group>

          {/* Field 3 - Multiple values (tags) */}
          <Form.Group className="mb-4">
            <Form.Label>Field 3</Form.Label>
            <div className="tag-container">
              {field3Values.map((value, index) => (
                <Badge
                  key={index}
                  bg="light"
                  text="dark"
                  className="tag-badge me-2 mb-2"
                >
                  {value}
                  <button
                    type="button"
                    className="tag-remove-btn"
                    onClick={() => removeValue(index, "field3")}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </Form.Group>

          {/* Field 4 - Single value (tag) */}
          <Form.Group className="mb-4">
            <Form.Label>Field 4</Form.Label>
            <div className="tag-container">
              {field4Values.map((value, index) => (
                <Badge
                  key={index}
                  bg="light"
                  text="dark"
                  className="tag-badge me-2 mb-2"
                >
                  {value}
                  <button
                    type="button"
                    className="tag-remove-btn"
                    onClick={() => removeValue(index, "field4")}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </Form.Group>

          {/* Field 5 - Multiple values (tags) */}
          <Form.Group className="mb-4">
            <Form.Label>Field 5</Form.Label>
            <div className="tag-container">
              {field5Values.map((value, index) => (
                <Badge
                  key={index}
                  bg="light"
                  text="dark"
                  className="tag-badge me-2 mb-2"
                >
                  {value}
                  <button
                    type="button"
                    className="tag-remove-btn"
                    onClick={() => removeValue(index, "field5")}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </Form.Group>

          {/* Edit Mode Actions */}
          <div className="d-flex gap-2 mt-4">
            <Button variant="dark" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outline-secondary" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
