import React, { useId, useState } from "react";
import { Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle, faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";

type EntityType = {
  name: string;
  url: string;
  description?: string;
  color?: string;
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

/** From this many options on, a list has a search of its own */
const SEARCH_THRESHOLD = 8;

function ItemListFilter({
  items,
  selectedItems,
  onItemToggle,
  placeholder = "Filter...",
  emptyMessage = "No items found matching",
  labels,
  descriptions,
  renderLabel,
  idPrefix = "item",
  listMaxHeight = 300,
}: Readonly<{
  items: string[];
  selectedItems: string[];
  onItemToggle: (itemName: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  /** Optional labels of the items (by item) shown instead of the item itself */
  labels?: Record<string, string>;
  /** Optional descriptions of the items (by item) shown as tooltip */
  descriptions?: Record<string, string | undefined>;
  /** Optional rendering of the label of an item - the text it is found by is still the label (or the item) */
  renderLabel?: (item: string) => React.ReactNode;
  idPrefix?: string;
  listMaxHeight?: number;
}>) {
  const [filter, setFilter] = useState("");

  const labelOf = (item: string) => labels?.[item] ?? item;
  const query = filter.trim().toLowerCase();
  const filteredItems = items.filter(
    (item) =>
      labelOf(item).toLowerCase().includes(query) ||
      item.toLowerCase().includes(query),
  );
  // A short list is shown as it is - the search is for the lists which are too long to scan
  const searchable = items.length > SEARCH_THRESHOLD;

  if (items.length === 0) {
    return <div className="instance-filter-empty text-muted">No options</div>;
  }

  return (
    <div>
      {searchable && (
        <input
          type="text"
          className="form-control mb-3"
          placeholder={placeholder}
          aria-label={placeholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      {searchable && query && (
        <div className="instance-filter-match-count text-muted">
          {filteredItems.length} of {items.length}
        </div>
      )}
      <div
        className="instance-filter-options"
        style={{ maxHeight: listMaxHeight, overflowY: "auto" }}
      >
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <Form.Check
              key={item}
              type="checkbox"
              id={`${idPrefix}-${item}`}
              label={renderLabel ? renderLabel(item) : labelOf(item)}
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

/**
 * A filter of the panel: its name with the number of options (and how many are selected), a way to clear it and a way
 * to fold it away - so a filter with many options doesn't push the others out of view.
 */
function FilterSection({
  title,
  total,
  selected,
  onClear,
  children,
}: {
  title: string;
  total: number;
  selected: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const contentId = useId();

  return (
    <section className="instance-filter-section">
      <div className="instance-filter-section-header">
        <h3 className="instance-filter-sheet-title">
          <button
            type="button"
            className="instance-filter-section-toggle"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => setOpen(!open)}
          >
            <FontAwesomeIcon
              icon={open ? faChevronDown : faChevronRight}
              className="instance-filter-section-chevron"
              aria-hidden="true"
            />
            {title}
          </button>
        </h3>
        <span
          className={`instance-filter-section-count${
            selected > 0 ? " instance-filter-section-count--active" : ""
          }`}
          title={`${total} option${total === 1 ? "" : "s"}${
            selected > 0 ? `, ${selected} selected` : ""
          }`}
        >
          {selected > 0 ? `${selected} of ${total}` : total}
        </span>
        {selected > 0 && (
          <button
            type="button"
            className="instance-filter-section-clear"
            aria-label={`Clear ${title}`}
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>
      <div id={contentId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function InstanceFilterPanel({
  filters,
  onFiltersChange,
  availableTypes,
  availableSpaces,
  variant = "toolbar",
}: Readonly<InstanceFilterPanelProps>) {
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
      renderLabel={renderType}
      onItemToggle={handleTypeToggle}
      placeholder="Filter types..."
      emptyMessage="No types found matching"
      idPrefix="type"
      listMaxHeight={180}
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
      listMaxHeight={180}
    />
  );

  const statuses: { value: string; label: string }[] = [
    { value: "released", label: "Released" },
    { value: "has changed", label: "Has Changed" },
    { value: "in progress", label: "In Progress" },
  ];

  return (
    <div className="instance-filter-sheet">
      <FilterSection
        title="Type"
        total={availableTypes.length}
        selected={filters.types.length}
        onClear={() => onFiltersChange({ ...filters, types: [] })}
      >
        {typeList}
      </FilterSection>
      <FilterSection
        title="Space"
        total={availableSpaces.length}
        selected={filters.spaces.length}
        onClear={() => onFiltersChange({ ...filters, spaces: [] })}
      >
        {spaceList}
      </FilterSection>
      <FilterSection
        title="Release status"
        total={statuses.length}
        selected={filters.releaseStatuses.length}
        onClear={() => onFiltersChange({ ...filters, releaseStatuses: [] })}
      >
        {statuses.map(({ value, label }) => (
          <Form.Check
            key={value}
            type="checkbox"
            id={`status-${value.replace(" ", "-")}`}
            label={label}
            checked={filters.releaseStatuses.includes(value)}
            onChange={() => handleStatusToggle(value)}
            className="mb-2"
          />
        ))}
      </FilterSection>
    </div>
  );
}
