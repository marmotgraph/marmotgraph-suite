import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Modal } from "react-bootstrap";
import { useAuth } from "../contexts/AuthContext";
import { useUnsavedInstances } from "../contexts/UnsavedInstancesContext";
import { useSpaces } from "../hooks/useSpaces";
import { useTypes } from "../hooks/useTypes";
import {
  emptyInstanceFieldValues,
  enrichLinkedInstancesWithDrafts,
  idsToLinkedInstances,
  InstanceSummary,
  LinkedInstance,
  normalizeLinkedInstancesForField,
} from "../modules/editor/editorMockData";
import { fetchInstances } from "../services/instances";
import { typeLabel } from "../services/types";
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
  fieldLabel: string;
  /** The types (identifiers) of the instances which can be linked - all if empty */
  allowedTypes: string[];
  linkedInstances: LinkedInstance[];
  currentInstanceId?: string;
  parentSpace?: string;
  onApply: (linkedInstances: LinkedInstance[]) => void;
};

function toLinkedInstance(instance: InstanceSummary): LinkedInstance {
  return {
    instanceId: instance.instanceId,
    instanceName: instance.instanceName,
    type: instance.type,
    typeColor: instance.typeColor,
    space: instance.space,
  };
}

function getInitialCreatedInstances(instances: LinkedInstance[]): LinkedInstance[] {
  return instances.filter((instance) => instance.isDraft && instance.isNew);
}

export default function LinkedInstancesEditModal({
  show,
  onHide,
  fieldLabel,
  allowedTypes,
  linkedInstances,
  currentInstanceId,
  parentSpace = "",
  onApply,
}: LinkedInstancesEditModalProps) {
  const { getAccessToken } = useAuth();
  const { getDraft, upsertDraft, removeDraft } = useUnsavedInstances();
  const types = useTypes();
  const spaces = useSpaces();
  const sessionCreatedIdsRef = useRef<Set<string>>(new Set());
  // The identifiers of the types which can be linked by their label (all known types if the field doesn't restrict them)
  const typeIdentifiersByLabel = useMemo(() => {
    const known = new Map(types.map((type) => [type.identifier, type]));
    const identifiers =
      allowedTypes.length > 0 ? allowedTypes : types.map((type) => type.identifier);
    return new Map(
      identifiers.map((identifier) => [
        typeLabel(known.get(identifier) ?? { identifier }),
        identifier,
      ]),
    );
  }, [allowedTypes, types]);
  // The types new instances can be created for (only if the field restricts them)
  const allowedTypeLabels = useMemo(
    () => (allowedTypes.length > 0 ? [...typeIdentifiersByLabel.keys()] : []),
    [allowedTypes, typeIdentifiersByLabel],
  );
  const availableTypes = useMemo(
    () => [...typeIdentifiersByLabel.keys()].sort(),
    [typeIdentifiersByLabel],
  );
  const availableSpaces = useMemo(
    () => [...new Set(spaces.map((space) => space.identifier))].sort(),
    [spaces],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [loadedInstances, setLoadedInstances] = useState<LinkedInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The available instances are loaded from the backend - restricted to the selected types or (if none is selected) to
  // those which can be linked by the field
  useEffect(() => {
    if (!show) {
      return;
    }
    const queriedTypes =
      selectedTypes.length > 0
        ? selectedTypes.flatMap((label) => typeIdentifiersByLabel.get(label) ?? [])
        : allowedTypes;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getAccessToken()
      .then((token) =>
        fetchInstances(token, { types: queriedTypes, spaces: selectedSpaces }),
      )
      .then(
        (loaded) =>
          !cancelled &&
          setLoadedInstances(
            loaded.instances
              .filter((instance) => instance.instanceId !== currentInstanceId)
              .map(toLinkedInstance),
          ),
      )
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadedInstances([]);
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [
    show,
    getAccessToken,
    allowedTypes,
    typeIdentifiersByLabel,
    selectedTypes,
    selectedSpaces,
    currentInstanceId,
  ]);

  const selectableCatalog = useMemo(
    () => enrichLinkedInstancesWithDrafts(loadedInstances, getDraft),
    [loadedInstances, getDraft],
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
    onHide();
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
          Manage {fieldLabel}
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
          allowedTypes={allowedTypeLabels}
          defaultSpace={parentSpace}
          show={show}
          onCreate={handleCreateInstances}
        />

        <InstanceTransferList
          instances={allInstances}
          availableInstances={selectableCatalog}
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

              {loading && (
                <div className="text-muted small">Loading instances...</div>
              )}
              {loadError && <div className="text-danger small">{loadError}</div>}

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
          {selectedIds.length} in {fieldLabel}
        </Badge>
        <Button type="button" variant="outline-secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button type="button" variant="dark" onClick={handleApply}>
          Apply
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
