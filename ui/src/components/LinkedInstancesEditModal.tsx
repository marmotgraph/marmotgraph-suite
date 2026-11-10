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
import { fetchInstances, InstanceQuery } from "../services/instances";
import { typeLabel } from "../services/types";
import {
  FilterPillsOverflow,
  formatSpaceFilterValue,
} from "./FilterPillsOverflow";
import LinkedInstancesCreatePanel from "./LinkedInstancesCreatePanel";
import { MultiSelectFilterDropdown } from "./MultiSelectFilterDropdown";
import InstanceSingleSelectList from "./InstanceSingleSelectList";
import InstanceTransferList, { InstanceListPaging, matchesSearch } from "./InstanceTransferList";
import "./LinkedInstancesEditModal.css";

type LinkedInstancesEditModalProps = {
  show: boolean;
  onHide: () => void;
  fieldLabel: string;
  /** The types (identifiers) of the instances which can be linked - all if empty */
  allowedTypes: string[];
  /** If at most one instance can be linked */
  single?: boolean;
  linkedInstances: LinkedInstance[];
  currentInstanceId?: string;
  parentSpace?: string;
  onApply: (linkedInstances: LinkedInstance[]) => void;
};

/** How long the search waits for further typing before it asks the server */
const SEARCH_DELAY_MS = 300;

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
  single = false,
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
  // The search term as typed - and as sent to the server once the typing pauses
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loadedInstances, setLoadedInstances] = useState<LinkedInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The further pages of the query the instances were loaded with - a page arriving after the query has changed is
  // ignored (the query is identified by its generation)
  const [nextMarker, setNextMarker] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const queryRef = useRef<{ generation: number; query: InstanceQuery }>({ generation: 0, query: {} });

  useEffect(() => {
    const timeout = setTimeout(() => setAppliedSearch(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  // The available instances are loaded from the backend - matching the search, restricted to the selected types or (if
  // none is selected) to those which can be linked by the field
  useEffect(() => {
    if (!show) {
      return;
    }
    const queriedTypes =
      selectedTypes.length > 0
        ? selectedTypes.flatMap((label) => typeIdentifiersByLabel.get(label) ?? [])
        : allowedTypes;
    const query: InstanceQuery = { search: appliedSearch, types: queriedTypes, spaces: selectedSpaces };
    queryRef.current = { generation: queryRef.current.generation + 1, query };
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNextMarker(undefined);
    setLoadingMore(false);
    setLoadMoreFailed(false);
    getAccessToken()
      .then((token) => fetchInstances(token, query))
      .then((loaded) => {
        if (!cancelled) {
          setLoadedInstances(
            loaded.instances
              .filter((instance) => instance.instanceId !== currentInstanceId)
              .map(toLinkedInstance),
          );
          setNextMarker(loaded.nextMarker);
        }
      })
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
    appliedSearch,
    currentInstanceId,
  ]);

  const loadMore = useCallback(() => {
    if (!nextMarker || loading || loadingMore) {
      return;
    }
    const { generation, query } = queryRef.current;
    const isCurrent = () => queryRef.current.generation === generation;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    getAccessToken()
      .then((token) => fetchInstances(token, { ...query, marker: nextMarker }))
      .then((loaded) => {
        if (!isCurrent()) {
          return;
        }
        setLoadedInstances((previous) => {
          const known = new Set(previous.map((instance) => instance.instanceId));
          return [
            ...previous,
            ...loaded.instances
              .filter((instance) => instance.instanceId !== currentInstanceId && !known.has(instance.instanceId))
              .map(toLinkedInstance),
          ];
        });
        setNextMarker(loaded.nextMarker);
      })
      .catch(() => isCurrent() && setLoadMoreFailed(true))
      .finally(() => isCurrent() && setLoadingMore(false));
  }, [currentInstanceId, getAccessToken, loading, loadingMore, nextMarker]);
  const paging = useMemo<InstanceListPaging>(
    () => ({ hasMore: !loading && Boolean(nextMarker), loadingMore, failed: loadMoreFailed, onLoadMore: loadMore }),
    [loadMoreFailed, loading, loadMore, loadingMore, nextMarker],
  );

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
  // The instances created in the dialog are not part of the catalog but can still be chosen - the server doesn't know
  // them, so they are matched with the search here
  const singleSelectInstances = useMemo(() => {
    const catalogIds = new Set(selectableCatalog.map((instance) => instance.instanceId));
    return [
      ...createdInstances.filter(
        (instance) => !catalogIds.has(instance.instanceId) && matchesSearch(instance, search),
      ),
      ...selectableCatalog,
    ];
  }, [createdInstances, search, selectableCatalog]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (show && !wasOpenRef.current) {
      sessionCreatedIdsRef.current = new Set();
      setCreatedInstances(getInitialCreatedInstances(enrichedLinkedInstances));
      const initialIds = enrichedLinkedInstances.map((instance) => instance.instanceId);
      setSelectedIds(single ? initialIds.slice(-1) : initialIds);
      setSelectedTypes([]);
      setSelectedSpaces([]);
      setSearch("");
      setAppliedSearch("");
    }

    wasOpenRef.current = show;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init only when opening
  }, [show]);

  const registerCreatedInstances = useCallback(
    (instances: LinkedInstance[]) => {
      const timestamp = Date.now();

      for (const instance of instances) {
        const typeIdentifier = typeIdentifiersByLabel.get(instance.type);
        const labelProperty = types.find((type) => type.identifier === typeIdentifier)?.labelProperty;
        upsertDraft({
          instanceId: instance.instanceId,
          instanceName: instance.instanceName,
          type: instance.type,
          // The name is the value of the label field of the type - so it is stored with the instance
          fieldValues: labelProperty
            ? { ...emptyInstanceFieldValues, [labelProperty]: instance.instanceName }
            : emptyInstanceFieldValues,
          updatedAt: timestamp,
          isNew: true,
          typeIdentifier,
          space: instance.space,
        });
        sessionCreatedIdsRef.current.add(instance.instanceId);
      }
    },
    [typeIdentifiersByLabel, types, upsertDraft],
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

      // A single link can only ever use one new instance - it replaces the one created before
      const replacedIds = single ? new Set(sessionCreatedIdsRef.current) : new Set<string>();
      if (single) {
        discardSessionCreatedInstances();
      }

      registerCreatedInstances(instances);
      setCreatedInstances((previous) => {
        const merged = new Map(
          previous
            .filter((instance) => !replacedIds.has(instance.instanceId))
            .map((instance) => [instance.instanceId, instance]),
        );

        for (const instance of instances) {
          merged.set(instance.instanceId, instance);
        }

        return [...merged.values()];
      });
      setSelectedIds((previous) => [
        ...(single ? [] : previous),
        ...instances
          .map((instance) => instance.instanceId)
          .filter((instanceId) => single || !previous.includes(instanceId)),
      ]);
    },
    [discardSessionCreatedInstances, registerCreatedInstances, single],
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

  const filters = (
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
  );

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      size={single ? "lg" : "xl"}
      className="linked-instances-edit-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {single ? (
            `Select ${fieldLabel}`
          ) : (
            <>
              Manage {fieldLabel}
              <span className="linked-instances-edit-modal-count ms-2">
                ({selectedIds.length} selected)
              </span>
            </>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="text-muted linked-instances-edit-modal-help">
          {single
            ? "Select the instance to link, or create a new one."
            : "Move instances from the available list on the left into the selected list on the right, or create new instances to link."}
        </p>

        <LinkedInstancesCreatePanel
          allowedTypes={allowedTypeLabels}
          defaultSpace={parentSpace}
          show={show}
          single={single}
          onCreate={handleCreateInstances}
        />

        {single ? (
          <InstanceSingleSelectList
            instances={singleSelectInstances}
            selected={allInstances.find((instance) => instance.instanceId === selectedIds[0])}
            onSelect={(instanceId) => setSelectedIds(instanceId ? [instanceId] : [])}
            emptyMessage={
              loading
                ? "Loading instances..."
                : loadError
                  ? "Could not load the instances"
                  : "No instances found"
            }
            filters={filters}
            search={search}
            onSearchChange={setSearch}
            paging={paging}
          />
        ) : (
          <InstanceTransferList
            instances={allInstances}
            availableInstances={selectableCatalog}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            availableFilters={filters}
            availableSearch={search}
            onAvailableSearchChange={setSearch}
            availablePaging={paging}
          />
        )}
      </Modal.Body>

      <Modal.Footer>
        {!single && (
          <Badge
            bg="light"
            text="dark"
            className="linked-instances-edit-modal-badge"
          >
            {selectedIds.length} in {fieldLabel}
          </Badge>
        )}
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
