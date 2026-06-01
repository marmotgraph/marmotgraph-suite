import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Modal } from "react-bootstrap";
import { useUnsavedInstances } from "../contexts/UnsavedInstancesContext";
import {
  emptyInstanceFieldValues,
  enrichLinkedInstancesWithDrafts,
  getSelectableInstancesForField,
  idsToLinkedInstances,
  instanceLinkedFieldConfig,
  InstanceLinkedFieldKey,
  isUnsavedInstanceId,
  LinkedInstance,
  normalizeLinkedInstancesForField,
} from "../modules/editor/editorMockData";
import {
  FilterPillsOverflow,
  formatSpaceFilterValue,
} from "./FilterPillsOverflow";
import LinkedInstancesCreatePanel from "./LinkedInstancesCreatePanel";
import { MultiSelectFilterDropdown } from "./MultiSelectFilterDropdown";
import InstanceTransferList from "./InstanceTransferList";
import "./LinkedInstancesEditModal.css";

type LinkedInstancesEditModalProps = {
  show: boolean;
  onHide: () => void;
  fieldKey: InstanceLinkedFieldKey;
  linkedInstances: LinkedInstance[];
  currentInstanceId?: string;
  parentSpace?: string;
  onApply: (linkedInstances: LinkedInstance[]) => void;
};

function getInitialCreatedInstances(instances: LinkedInstance[]): LinkedInstance[] {
  return instances.filter(
    (instance) =>
      isUnsavedInstanceId(instance.instanceId) ||
      (instance.isDraft && instance.isNew),
  );
}

export default function LinkedInstancesEditModal({
  show,
  onHide,
  fieldKey,
  linkedInstances,
  currentInstanceId,
  parentSpace = "",
  onApply,
}: LinkedInstancesEditModalProps) {
  const { getDraft, upsertDraft, removeDraft } = useUnsavedInstances();
  const fieldConfig = instanceLinkedFieldConfig[fieldKey];
  const sessionCreatedIdsRef = useRef<Set<string>>(new Set());
  const selectableCatalog = useMemo(
    () =>
      enrichLinkedInstancesWithDrafts(
        getSelectableInstancesForField(fieldKey, currentInstanceId),
        getDraft,
      ),
    [currentInstanceId, fieldKey, getDraft],
  );
  const enrichedLinkedInstances = useMemo(
    () => enrichLinkedInstancesWithDrafts(linkedInstances, getDraft),
    [getDraft, linkedInstances],
  );
  const [createdInstances, setCreatedInstances] = useState<LinkedInstance[]>([]);
  const allInstances = useMemo(() => {
    const merged = new Map<string, LinkedInstance>();

    for (const instance of [
      ...selectableCatalog,
      ...enrichedLinkedInstances,
      ...createdInstances,
    ]) {
      merged.set(instance.instanceId, instance);
    }

    return [...merged.values()];
  }, [createdInstances, enrichedLinkedInstances, selectableCatalog]);
  const availableTypes = useMemo(
    () =>
      [
        ...new Set([
          ...fieldConfig.allowedTypes,
          ...selectableCatalog.map((instance) => instance.type),
        ]),
      ].sort(),
    [fieldConfig.allowedTypes, selectableCatalog],
  );
  const availableSpaces = useMemo(
    () =>
      [...new Set(selectableCatalog.map((instance) => instance.space))].sort(),
    [selectableCatalog],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (show && !wasOpenRef.current) {
      sessionCreatedIdsRef.current = new Set();
      setCreatedInstances(getInitialCreatedInstances(enrichedLinkedInstances));
      setSelectedIds(
        enrichedLinkedInstances.map((instance) => instance.instanceId),
      );
      setSelectedTypes([]);
      setSelectedSpaces([]);
    }

    wasOpenRef.current = show;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init only when opening
  }, [show]);

  const registerCreatedInstances = useCallback(
    (instances: LinkedInstance[]) => {
      const timestamp = Date.now();

      for (const instance of instances) {
        upsertDraft({
          instanceId: instance.instanceId,
          instanceName: instance.instanceName,
          type: instance.type,
          fieldValues: emptyInstanceFieldValues,
          updatedAt: timestamp,
          isNew: true,
        });
        sessionCreatedIdsRef.current.add(instance.instanceId);
      }
    },
    [upsertDraft],
  );

  const discardSessionCreatedInstances = useCallback(() => {
    const originalIds = new Set(linkedInstances.map((instance) => instance.instanceId));

    for (const instanceId of sessionCreatedIdsRef.current) {
      if (!originalIds.has(instanceId)) {
        removeDraft(instanceId);
      }
    }

    sessionCreatedIdsRef.current = new Set();
  }, [linkedInstances, removeDraft]);

  const handleCreateInstances = useCallback(
    (instances: LinkedInstance[]) => {
      if (instances.length === 0) {
        return;
      }

      registerCreatedInstances(instances);
      setCreatedInstances((previous) => {
        const merged = new Map(previous.map((instance) => [instance.instanceId, instance]));

        for (const instance of instances) {
          merged.set(instance.instanceId, instance);
        }

        return [...merged.values()];
      });
      setSelectedIds((previous) => [
        ...previous,
        ...instances
          .map((instance) => instance.instanceId)
          .filter((instanceId) => !previous.includes(instanceId)),
      ]);
    },
    [registerCreatedInstances],
  );

  const filteredCatalog = useMemo(() => {
    return selectableCatalog.filter((instance) => {
      const matchesType =
        selectedTypes.length === 0 || selectedTypes.includes(instance.type);
      const matchesSpace =
        selectedSpaces.length === 0 || selectedSpaces.includes(instance.space);

      return matchesType && matchesSpace;
    });
  }, [selectableCatalog, selectedSpaces, selectedTypes]);

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((previous) =>
      previous.includes(type)
        ? previous.filter((item) => item !== type)
        : [...previous, type],
    );
  };

  const handleSpaceToggle = (space: string) => {
    setSelectedSpaces((previous) =>
      previous.includes(space)
        ? previous.filter((item) => item !== space)
        : [...previous, space],
    );
  };

  const handleApply = () => {
    const selectedIdSet = new Set(selectedIds);

    for (const instanceId of sessionCreatedIdsRef.current) {
      if (!selectedIdSet.has(instanceId)) {
        removeDraft(instanceId);
      }
    }

    sessionCreatedIdsRef.current = new Set();
    onApply(
      normalizeLinkedInstancesForField(
        idsToLinkedInstances(selectedIds, allInstances),
      ),
    );
  };

  const handleClose = () => {
    discardSessionCreatedInstances();
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      size="xl"
      className="linked-instances-edit-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Manage {fieldConfig.label}
          <span className="linked-instances-edit-modal-count ms-2">
            ({selectedIds.length} selected)
          </span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="text-muted linked-instances-edit-modal-help">
          Move instances from the available list on the left into the selected
          list on the right, or create new instances to link.
        </p>

        <LinkedInstancesCreatePanel
          allowedTypes={fieldConfig.allowedTypes}
          defaultSpace={parentSpace}
          show={show}
          onCreate={handleCreateInstances}
        />

        <InstanceTransferList
          instances={allInstances}
          availableInstances={filteredCatalog}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          availableFilters={
            <div className="linked-instances-edit-modal-filters linked-instances-edit-modal-filters--available">
              <div className="linked-instances-edit-modal-filter-row">
                <span className="linked-instances-edit-modal-filter-label">
                  Filter
                </span>
                <div className="linked-instances-edit-modal-filter-controls">
                  <MultiSelectFilterDropdown
                    label="Type"
                    options={availableTypes}
                    selected={selectedTypes}
                    onChange={setSelectedTypes}
                    searchPlaceholder="Search types..."
                    emptyMessage="No types found"
                  />
                  <MultiSelectFilterDropdown
                    label="Space"
                    options={availableSpaces}
                    selected={selectedSpaces}
                    onChange={setSelectedSpaces}
                    searchPlaceholder="Search spaces..."
                    emptyMessage="No spaces found"
                    menuClassName="multi-select-filter-dropdown-menu--wide"
                  />
                </div>
              </div>

              {(selectedTypes.length > 0 || selectedSpaces.length > 0) && (
                <div className="linked-instances-edit-modal-filter-pills">
                  <div className="linked-instances-edit-modal-filter-pills-groups">
                    <FilterPillsOverflow
                      label="Type"
                      values={selectedTypes}
                      onRemove={handleTypeToggle}
                      onClearAll={() => setSelectedTypes([])}
                    />
                    <FilterPillsOverflow
                      label="Space"
                      values={selectedSpaces}
                      onRemove={handleSpaceToggle}
                      onClearAll={() => setSelectedSpaces([])}
                      formatValue={formatSpaceFilterValue}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="linked-instances-edit-modal-clear-filters p-0"
                    onClick={() => {
                      setSelectedTypes([]);
                      setSelectedSpaces([]);
                    }}
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          }
        />
      </Modal.Body>

      <Modal.Footer>
        <Badge
          bg="light"
          text="dark"
          className="linked-instances-edit-modal-badge"
        >
          {selectedIds.length} in {fieldConfig.label}
        </Badge>
        <Button type="button" variant="outline-secondary" onClick={handleClose}>
          Done
        </Button>
        <Button type="button" variant="dark" onClick={handleApply}>
          Apply
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
