import React, { useEffect, useMemo, useState } from "react";
import { Button, Collapse, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faPlus } from "@fortawesome/free-solid-svg-icons";
import {
  buildBulkInstanceNames,
  createDraftLinkedInstances,
  LinkedInstance,
} from "../modules/editor/editorMockData";
import "./LinkedInstancesCreatePanel.css";

const MAX_BULK_CREATE = 50;

type LinkedInstancesCreatePanelProps = {
  allowedTypes: string[];
  defaultSpace: string;
  show?: boolean;
  onCreate: (instances: LinkedInstance[]) => void;
};

export default function LinkedInstancesCreatePanel({
  allowedTypes,
  defaultSpace,
  show = true,
  onCreate,
}: LinkedInstancesCreatePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [createType, setCreateType] = useState(allowedTypes[0] ?? "");
  const [namePrefix, setNamePrefix] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [space, setSpace] = useState(defaultSpace);

  useEffect(() => {
    if (!show) {
      return;
    }

    setIsExpanded(false);
    setCreateType(allowedTypes[0] ?? "");
    setNamePrefix("");
    setQuantity(1);
    setSpace(defaultSpace);
  }, [allowedTypes, defaultSpace, show]);

  const previewNames = useMemo(
    () => buildBulkInstanceNames(namePrefix, quantity).slice(0, 5),
    [namePrefix, quantity],
  );
  const hiddenPreviewCount = Math.max(
    buildBulkInstanceNames(namePrefix, quantity).length - previewNames.length,
    0,
  );
  const canCreate =
    createType.trim().length > 0 &&
    namePrefix.trim().length > 0 &&
    quantity >= 1 &&
    quantity <= MAX_BULK_CREATE &&
    space.trim().length > 0;

  const handleCreate = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const names = buildBulkInstanceNames(namePrefix, quantity);

    if (names.length === 0) {
      return;
    }

    onCreate(
      createDraftLinkedInstances(createType, names, space.trim()),
    );

    setNamePrefix("");
    setQuantity(1);
  };

  return (
    <div className="linked-instances-create-panel mb-3">
      <Button
        type="button"
        variant="link"
        size="sm"
        className="linked-instances-create-panel-toggle p-0"
        onClick={() => setIsExpanded((previous) => !previous)}
        aria-expanded={isExpanded}
        aria-controls="linked-instances-create-panel-form"
      >
        <FontAwesomeIcon icon={faPlus} className="me-2" />
        Create new instance
        <FontAwesomeIcon
          icon={isExpanded ? faChevronUp : faChevronDown}
          className="ms-2 linked-instances-create-panel-toggle-icon"
        />
      </Button>

      <Collapse in={isExpanded}>
        <div
          id="linked-instances-create-panel-form"
          className="linked-instances-create-panel-form"
        >
          <div className="linked-instances-create-panel-fields">
            <Form.Group className="linked-instances-create-panel-field">
              <Form.Label>Type</Form.Label>
              <Form.Select
                value={createType}
                onChange={(event) => setCreateType(event.target.value)}
                aria-label="Type for new instance"
              >
                {allowedTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="linked-instances-create-panel-field linked-instances-create-panel-field--name">
              <Form.Label>
                {quantity > 1 ? "Name prefix" : "Name"}
              </Form.Label>
              <Form.Control
                type="text"
                value={namePrefix}
                onChange={(event) => setNamePrefix(event.target.value)}
                placeholder={
                  quantity > 1 ? "e.g. Blade-Rack-A" : "e.g. Blade-Rack-A1"
                }
              />
            </Form.Group>

            <Form.Group className="linked-instances-create-panel-field linked-instances-create-panel-field--quantity">
              <Form.Label>Qty</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={MAX_BULK_CREATE}
                value={quantity}
                onChange={(event) => {
                  const nextValue = Number.parseInt(event.target.value, 10);

                  if (Number.isNaN(nextValue)) {
                    setQuantity(1);
                    return;
                  }

                  setQuantity(
                    Math.min(Math.max(nextValue, 1), MAX_BULK_CREATE),
                  );
                }}
              />
            </Form.Group>

            <Form.Group className="linked-instances-create-panel-field linked-instances-create-panel-field--space">
              <Form.Label>Space</Form.Label>
              <Form.Control
                type="text"
                value={space}
                onChange={(event) => setSpace(event.target.value)}
                placeholder="Space for new instance"
              />
            </Form.Group>
          </div>

          {previewNames.length > 0 && quantity > 1 && (
            <div className="linked-instances-create-panel-preview text-muted">
              Will create: {previewNames.join(", ")}
              {hiddenPreviewCount > 0 && `, +${hiddenPreviewCount} more`}
            </div>
          )}

          <div className="linked-instances-create-panel-actions">
            <Button
              type="button"
              variant="outline-dark"
              size="sm"
              onClick={handleCreate}
              disabled={!canCreate}
            >
              Create &amp; add{quantity > 1 ? ` (${quantity})` : ""}
            </Button>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
