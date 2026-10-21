import React, { useState } from "react";
import {
  Button,
  Form,
  Modal,
} from "react-bootstrap";

type EntityType = {
  name: string;
  url: string;
};

type InstanceFilters = {
  types: string[];
  spaces: string[];
  permissions: string[];
  releaseStatuses: string[];
};

type InstanceFilterPanelProps = {
  filters: InstanceFilters;
  onFiltersChange: (filters: InstanceFilters) => void;
  availableTypes: EntityType[];
  availableSpaces: string[];
};

function ItemListFilter({
  items,
  selectedItems,
  onItemToggle,
  placeholder = "Filter...",
  emptyMessage = "No items found matching",
}: {
  items: string[];
  selectedItems: string[];
  onItemToggle: (itemName: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}) {
  const [filter, setFilter] = useState("");

  const filteredItems = items.filter((item) =>
    item.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div>
      <input
        type="text"
        className="form-control mb-3"
        placeholder={placeholder}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Form.Check
              key={item}
              type="checkbox"
              id={`item-${item}`}
              label={item}
              checked={selectedItems.includes(item)}
              onChange={() => onItemToggle(item)}
              className="mb-2"
            />
          ))
        ) : (
          <div className="text-muted">
            {emptyMessage} "{filter}"
          </div>
        )}
      </div>
    </div>
  );
}

export function InstanceFilterPanel({
  filters,
  onFiltersChange,
  availableTypes,
  availableSpaces,
}: InstanceFilterPanelProps) {
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showSpaceModal, setShowSpaceModal] = useState(false);

  const handleTypeToggle = (typeName: string) => {
    const newTypes = filters.types.includes(typeName)
      ? filters.types.filter((t) => t !== typeName)
      : [...filters.types, typeName];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handleSpaceToggle = (space: string) => {
    const newSpaces = filters.spaces.includes(space)
      ? filters.spaces.filter((s) => s !== space)
      : [...filters.spaces, space];
    onFiltersChange({ ...filters, spaces: newSpaces });
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.releaseStatuses.includes(status)
      ? filters.releaseStatuses.filter((s) => s !== status)
      : [...filters.releaseStatuses, status];
    onFiltersChange({ ...filters, releaseStatuses: newStatuses });
  };

  const activeFilterCount =
    filters.types.length +
    filters.spaces.length +
    filters.releaseStatuses.length;

  return (
    <>
      <div className="d-flex gap-2 align-items-center flex-wrap">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setShowTypeModal(true)}
        >
          Type ({filters.types.length})
        </Button>

        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setShowSpaceModal(true)}
        >
          Space ({filters.spaces.length})
        </Button>

        <Form.Check
          type="checkbox"
          id="status-released"
          label="Released"
          checked={filters.releaseStatuses.includes("released")}
          onChange={() => handleStatusToggle("released")}
        />
        <Form.Check
          type="checkbox"
          id="status-in-progress"
          label="In Progress"
          checked={filters.releaseStatuses.includes("in progress")}
          onChange={() => handleStatusToggle("in progress")}
        />

        {activeFilterCount > 0 && (
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() =>
              onFiltersChange({
                types: [],
                spaces: [],
                permissions: [],
                releaseStatuses: [],
              })
            }
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Type Selection Modal */}
      <Modal show={showTypeModal} onHide={() => setShowTypeModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Select Types</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ItemListFilter
            items={availableTypes.map((t) => t.name)}
            selectedItems={filters.types}
            onItemToggle={handleTypeToggle}
            placeholder="Filter types..."
            emptyMessage="No types found matching"
          />
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          <Button
            variant="outline-danger"
            onClick={() => onFiltersChange({ ...filters, types: [] })}
            disabled={filters.types.length === 0}
          >
            Clear Types
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowTypeModal(false)}
          >
            Done
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Space Selection Modal */}
      <Modal show={showSpaceModal} onHide={() => setShowSpaceModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Select Spaces</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ItemListFilter
            items={availableSpaces}
            selectedItems={filters.spaces}
            onItemToggle={handleSpaceToggle}
            placeholder="Filter spaces..."
            emptyMessage="No spaces found matching"
          />
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          <Button
            variant="outline-danger"
            onClick={() => onFiltersChange({ ...filters, spaces: [] })}
            disabled={filters.spaces.length === 0}
          >
            Clear Spaces
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowSpaceModal(false)}
          >
            Done
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
