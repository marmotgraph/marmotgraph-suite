import React, { useState } from "react";
import {
  Button,
  Form,
  Modal,
} from "react-bootstrap";

type EntityType = {
  name: string;
  url: string;
  description?: string;
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
  /** Toolbar shows one button per filter. Stacked shows every filter in place, for a single mobile sheet. */
  variant?: "toolbar" | "stacked";
};

function ItemListFilter({
  items,
  selectedItems,
  onItemToggle,
  placeholder = "Filter...",
  emptyMessage = "No items found matching",
  labels,
  descriptions,
  idPrefix = "item",
  listMaxHeight = 300,
}: {
  items: string[];
  selectedItems: string[];
  onItemToggle: (itemName: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  /** Optional labels of the items (by item) shown instead of the item itself */
  labels?: Record<string, string>;
  /** Optional descriptions of the items (by item) shown as tooltip */
  descriptions?: Record<string, string | undefined>;
  idPrefix?: string;
  listMaxHeight?: number;
}) {
  const [filter, setFilter] = useState("");

  const labelOf = (item: string) => labels?.[item] ?? item;
  const filteredItems = items.filter((item) =>
    labelOf(item).toLowerCase().includes(filter.toLowerCase()),
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
      <div style={{ maxHeight: listMaxHeight, overflowY: "auto" }}>
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Form.Check
              key={item}
              type="checkbox"
              id={`${idPrefix}-${item}`}
              label={labelOf(item)}
              title={descriptions?.[item]}
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
  variant = "toolbar",
}: InstanceFilterPanelProps) {
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showSpaceModal, setShowSpaceModal] = useState(false);

  const handleTypeToggle = (typeUrl: string) => {
    const newTypes = filters.types.includes(typeUrl)
      ? filters.types.filter((t) => t !== typeUrl)
      : [...filters.types, typeUrl];
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

  const typeList = (
    <ItemListFilter
      items={availableTypes.map((t) => t.url)}
      labels={Object.fromEntries(availableTypes.map((t) => [t.url, t.name]))}
      descriptions={Object.fromEntries(
        availableTypes.map((t) => [t.url, t.description]),
      )}
      selectedItems={filters.types}
      onItemToggle={handleTypeToggle}
      placeholder="Filter types..."
      emptyMessage="No types found matching"
      idPrefix="type"
      listMaxHeight={variant === "stacked" ? 180 : 300}
    />
  );

  const spaceList = (
    <ItemListFilter
      items={availableSpaces}
      selectedItems={filters.spaces}
      onItemToggle={handleSpaceToggle}
      placeholder="Filter spaces..."
      emptyMessage="No spaces found matching"
      idPrefix="space"
      listMaxHeight={variant === "stacked" ? 180 : 300}
    />
  );

  if (variant === "stacked") {
    return (
      <div className="instance-filter-sheet">
        <section>
          <h3 className="instance-filter-sheet-title">Type</h3>
          {typeList}
        </section>
        <section>
          <h3 className="instance-filter-sheet-title">Space</h3>
          {spaceList}
        </section>
        <section>
          <h3 className="instance-filter-sheet-title">Release status</h3>
          <Form.Check
            type="checkbox"
            id="status-released"
            label="Released"
            checked={filters.releaseStatuses.includes("released")}
            onChange={() => handleStatusToggle("released")}
            className="mb-2"
          />
          <Form.Check
            type="checkbox"
            id="status-in-progress"
            label="In Progress"
            checked={filters.releaseStatuses.includes("in progress")}
            onChange={() => handleStatusToggle("in progress")}
          />
        </section>
      </div>
    );
  }

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
        <Modal.Body>{typeList}</Modal.Body>
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
        <Modal.Body>{spaceList}</Modal.Body>
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
