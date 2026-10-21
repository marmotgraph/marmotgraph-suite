import React, { useMemo, useState } from "react";
import { Badge, Button, Form, Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircle,
  faCopy,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useUnsavedInstances } from "../contexts/UnsavedInstancesContext";
import {
  enrichLinkedInstancesWithDrafts,
  LinkedInstance,
} from "../modules/editor/editorMockData";
import LinkedInstanceDraftBadge from "./LinkedInstanceDraftBadge";
import { SearchBar } from "./SearchBar";
import { FilterPill } from "./FilterPill";
import "./LinkedInstancesModal.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

type LinkedInstancesModalProps = {
  show: boolean;
  onHide: () => void;
  fieldLabel: string;
  linkedInstances: LinkedInstance[];
  onInstanceClick: (instanceId: string) => void;
  isEditMode?: boolean;
  onRemove?: (instanceId: string) => void;
};

export default function LinkedInstancesModal({
  show,
  onHide,
  fieldLabel,
  linkedInstances,
  onInstanceClick,
  isEditMode = false,
  onRemove,
}: LinkedInstancesModalProps) {
  const { getDraft } = useUnsavedInstances();
  const displayInstances = useMemo(
    () => enrichLinkedInstancesWithDrafts(linkedInstances, getDraft),
    [getDraft, linkedInstances],
  );
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [typeFilterInput, setTypeFilterInput] = useState("");

  const availableTypes = useMemo(
    () =>
      [...new Set(displayInstances.map((instance) => instance.type))].sort(),
    [displayInstances],
  );

  const filteredInstances = useMemo(() => {
    const search = appliedSearch.trim().toLowerCase();

    return displayInstances.filter((instance) => {
      const matchesType =
        selectedTypes.length === 0 || selectedTypes.includes(instance.type);
      const matchesSearch =
        search.length === 0 ||
        instance.instanceName.toLowerCase().includes(search) ||
        instance.instanceId.toLowerCase().includes(search) ||
        instance.type.toLowerCase().includes(search);

      return matchesType && matchesSearch;
    });
  }, [appliedSearch, displayInstances, selectedTypes]);

  const filteredTypeOptions = availableTypes.filter((type) =>
    type.toLowerCase().includes(typeFilterInput.toLowerCase()),
  );

  const handleClose = () => {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedTypes([]);
    setTypeFilterInput("");
    setShowTypeFilter(false);
    onHide();
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  };

  const handleCopyId = (
    event: React.MouseEvent,
    instanceId: string,
  ) => {
    event.stopPropagation();
    navigator.clipboard.writeText(instanceId);
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      size="lg"
      className="linked-instances-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {fieldLabel}
          <span className="linked-instances-modal-count ms-2">
            ({displayInstances.length})
          </span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <div className="linked-instances-modal-toolbar mb-3">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            onSearch={() => setAppliedSearch(searchInput)}
            placeholder="Search by name, type, or ID..."
            ariaLabel={`Search ${fieldLabel} linked instances`}
          />

          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowTypeFilter((prev) => !prev)}
            >
              Type ({selectedTypes.length})
            </Button>

            {selectedTypes.length > 0 && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => setSelectedTypes([])}
              >
                Clear filters
              </Button>
            )}
          </div>

          {showTypeFilter && (
            <div className="linked-instances-type-filter mt-3">
              <Form.Control
                type="text"
                placeholder="Filter types..."
                value={typeFilterInput}
                onChange={(event) => setTypeFilterInput(event.target.value)}
                className="mb-2"
              />
              <div className="linked-instances-type-list">
                {filteredTypeOptions.length > 0 ? (
                  filteredTypeOptions.map((type) => (
                    <Form.Check
                      key={type}
                      type="checkbox"
                      id={`linked-instance-type-${type}`}
                      label={type}
                      checked={selectedTypes.includes(type)}
                      onChange={() => handleTypeToggle(type)}
                      className="mb-2"
                    />
                  ))
                ) : (
                  <div className="text-muted">
                    No types found matching "{typeFilterInput}"
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTypes.length > 0 && (
            <div className="mt-3">
              {selectedTypes.map((type) => (
                <FilterPill
                  key={type}
                  label="Type"
                  value={type}
                  onRemove={() =>
                    setSelectedTypes((prev) => prev.filter((item) => item !== type))
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="linked-instances-modal-summary text-muted mb-2">
          Showing {filteredInstances.length} of {displayInstances.length}
        </div>

        <div className="linked-instances-modal-list">
          {filteredInstances.length === 0 ? (
            <div className="linked-instances-modal-empty text-muted text-center py-4">
              No linked instances match your filters.
            </div>
          ) : (
            filteredInstances.map((instance) => {
              const typeColor = typeColors[instance.type] || "#6c757d";

              return (
                <div
                  key={instance.instanceId}
                  className={`linked-instances-modal-item${
                    instance.isDraft ? " linked-instances-modal-item--draft" : ""
                  }`}
                  onClick={() => onInstanceClick(instance.instanceId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onInstanceClick(instance.instanceId);
                    }
                  }}
                >
                  <div className="linked-instances-modal-item-main">
                    <div className="linked-instances-modal-item-type">
                      <FontAwesomeIcon
                        icon={faCircle}
                        className="me-2"
                        style={{ color: typeColor, fontSize: "0.55rem" }}
                      />
                      {instance.type}
                    </div>
                    <div className="linked-instances-modal-item-name">
                      {instance.instanceName}
                      <LinkedInstanceDraftBadge
                        instance={instance}
                        className="linked-instance-draft-badge--inline"
                      />
                    </div>
                    <div className="linked-instances-modal-item-meta">
                      <span>ID: {instance.instanceId}</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 ms-2"
                        onClick={(event) =>
                          handleCopyId(event, instance.instanceId)
                        }
                        title="Copy ID"
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </Button>
                    </div>
                  </div>

                  {isEditMode && onRemove && (
                    <Button
                      variant="link"
                      size="sm"
                      className="linked-instances-modal-remove-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(instance.instanceId);
                      }}
                      title="Remove linked instance"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Badge bg="light" text="dark" className="linked-instances-modal-footer-badge">
          {filteredInstances.length} shown
        </Badge>
        <Button variant="secondary" onClick={handleClose}>
          Done
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
