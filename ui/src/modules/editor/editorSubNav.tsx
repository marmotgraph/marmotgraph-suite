// src/modules/editor/editorSubNav.tsx
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

export const editorSubNav = {
  title: "Editor",
  ctas: [
    {
      label: "Create new instance",
      href: "/editor/new",
      variant: "dark" as const,
      size: "sm" as const,
      modal: {
        show: false,
        title: "Create New Instance",
        body: (
          onTypeSelect: (typeName: string) => void,
          onInstanceNameChange?: (name: string) => void,
          instanceName?: string
        ) => (
          <div>
            <div className="alert alert-info py-2 px-3 mb-3" style={{ fontSize: '0.85rem' }}>
              <strong>Note:</strong> The instance will be saved to your private space (<strong style={{ color: '#0056b3' }}>private-xxxxx</strong>) by default.
              You can change the space later when saving the instance.
            </div>
            <div className="mb-3">
              <label htmlFor="instance-name" className="form-label fw-bold">
                Instance name <span className="text-danger fw-bold">*</span>
              </label>
              <input
                type="text"
                id="instance-name"
                className="form-control form-control-sm"
                placeholder="Enter instance name..."
                value={instanceName || ""}
                onChange={(e) => onInstanceNameChange?.(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="type-filter" className="form-label fw-bold">
                Select type <span className="text-danger fw-bold">*</span>
              </label>
            </div>
            <TypeListFilter types={mockTypes} onTypeSelect={onTypeSelect} />
          </div>
        ),
      },
    },
  ],
};

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
        className="form-control form-control-sm mb-3"
        placeholder="Filter types..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className="list-group list-group-flush">
        {filteredTypes.length > 0 ? (
          filteredTypes.map((type) => (
            <li
              key={type.name}
              className="list-group-item"
              style={{
                cursor: "pointer",
                backgroundColor: selectedType?.name === type.name ? "#e9ecef" : "transparent",
                color: selectedType?.name === type.name ? "#212529" : "inherit",
              }}
              onClick={() => handleSelectType(type)}
            >
              <span className="fw-semibold">{type.name}</span>
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
