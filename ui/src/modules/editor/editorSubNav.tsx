// src/modules/editor/editorSubNav.tsx
import React, { useMemo, useState } from "react";
import { useTypes } from "../../hooks/useTypes";
import { typeLabel } from "../../services/types";

type EntityType = {
  name: string;
  identifier: string;
};

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
        body: (onTypeSelect: (typeIdentifier: string) => void) => (
          <div>
            <div className="alert alert-info py-2 px-3 mb-3" style={{ fontSize: '0.85rem' }}>
              <strong>Note:</strong> The instance will be saved to your private space (<strong style={{ color: '#0056b3' }}>private-xxxxx</strong>) by default.
              You can change the space later when saving the instance.
            </div>
            <div className="mb-3">
              <label htmlFor="type-filter" className="form-label fw-bold">
                Select type <span className="text-danger fw-bold">*</span>
              </label>
            </div>
            <TypeListFilter onTypeSelect={onTypeSelect} />
          </div>
        ),
      },
    },
  ],
};

/** Lists the types known to the core (loaded when the dialog is opened) to pick the one of the new instance from. */
function TypeListFilter({
  onTypeSelect,
}: {
  /** Called with the identifier of the selected type */
  onTypeSelect: (typeIdentifier: string) => void;
}) {
  const knownTypes = useTypes();
  const types = useMemo<EntityType[]>(
    () =>
      knownTypes
        .map((type) => ({ name: typeLabel(type), identifier: type.identifier }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [knownTypes],
  );
  const [filter, setFilter] = useState("");
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);

  const filteredTypes = types.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const handleSelectType = (type: EntityType) => {
    setSelectedType(type);
    onTypeSelect(type.identifier);
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
      {/* Scrolls on its own so a long list of types doesn't push the dialog beyond the screen */}
      <ul
        className="list-group list-group-flush border rounded"
        style={{ maxHeight: "40vh", overflowY: "auto" }}
      >
        {filteredTypes.length > 0 ? (
          filteredTypes.map((type) => (
            <li
              key={type.identifier}
              className="list-group-item"
              style={{
                cursor: "pointer",
                backgroundColor: selectedType?.identifier === type.identifier ? "#e9ecef" : "transparent",
                color: selectedType?.identifier === type.identifier ? "#212529" : "inherit",
              }}
              onClick={() => handleSelectType(type)}
            >
              <span className="fw-semibold">{type.name}</span>
            </li>
          ))
        ) : (
          <li className="list-group-item text-muted">
            {types.length === 0
              ? "No types available"
              : `No types found matching "${filter}"`}
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
