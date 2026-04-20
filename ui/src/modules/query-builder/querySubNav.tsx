// src/modules/query-builder/querySubNav.tsx
import React, { useState } from "react";

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

export const queryBuilderSubNav = {
  title: "Query Builder",
  ctas: [
    {
      label: "Browse shared queries",
      href: "/queries/shared",
      variant: "outline-dark" as const,
      size: "sm" as const,
    },
    {
      label: "Create new query",
      href: "/queries/new",
      variant: "dark" as const,
      size: "sm" as const,
      modal: {
        show: false,
        title: "Create New Query",
        // ← Change to the function that receives callback
        body: (onTypeSelect: (typeName: string) => void) => (
          <div>
            <div className="mb-3">
              <label htmlFor="type-filter" className="form-label fw-bold">
                Select type
              </label>
              <input
                type="text"
                id="type-filter"
                className="form-control"
                placeholder="Search for a type (e.g., Appliance)..."
              />
            </div>
            {/* Pass the callback to the component */}
            <TypeListFilter types={mockTypes} onTypeSelect={onTypeSelect} />
          </div>
        ),
        // onClose: () => {},
      },
    },
  ],
};

// Update the component to accept and use the callback
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
    onTypeSelect(type.name); // ← Notify parent
  };

  return (
    <div>
      {/* Add search input here if needed, or keep it in parent */}
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
                className="btn btn-sm btn-outline-light"
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
