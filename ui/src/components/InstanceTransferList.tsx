import React, { useMemo, useState } from "react";
import { Button, Col, Form, ListGroup, Row } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAnglesLeft,
  faAnglesRight,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircle,
} from "@fortawesome/free-solid-svg-icons";
import { LinkedInstance } from "../modules/editor/editorMockData";
import LinkedInstanceDraftBadge from "./LinkedInstanceDraftBadge";
import "./InstanceTransferList.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

type InstanceTransferListProps = {
  instances: LinkedInstance[];
  availableInstances: LinkedInstance[];
  selectedIds: string[];
  onSelectedIdsChange: (selectedIds: string[]) => void;
  availableFilters?: React.ReactNode;
};

function matchesSearch(instance: LinkedInstance, search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase();

  if (normalizedSearch === "") {
    return true;
  }

  return (
    instance.instanceName.toLowerCase().includes(normalizedSearch) ||
    instance.instanceId.toLowerCase().includes(normalizedSearch) ||
    instance.type.toLowerCase().includes(normalizedSearch)
  );
}

function groupInstancesByType(instances: LinkedInstance[]) {
  const grouped = instances.reduce<Record<string, LinkedInstance[]>>(
    (accumulator, instance) => {
      if (!accumulator[instance.type]) {
        accumulator[instance.type] = [];
      }

      accumulator[instance.type].push(instance);
      return accumulator;
    },
    {},
  );

  return Object.entries(grouped).sort(([leftType], [rightType]) =>
    leftType.localeCompare(rightType),
  );
}

function moveBlockUp(ids: string[], highlighted: Set<string>): string[] {
  const blockIds = ids.filter((id) => highlighted.has(id));

  if (blockIds.length === 0) {
    return ids;
  }

  const firstIndex = ids.findIndex((id) => highlighted.has(id));

  if (firstIndex <= 0) {
    return ids;
  }

  const next = ids.filter((id) => !highlighted.has(id));
  next.splice(firstIndex - 1, 0, ...blockIds);
  return next;
}

function moveBlockDown(ids: string[], highlighted: Set<string>): string[] {
  const blockIds = ids.filter((id) => highlighted.has(id));

  if (blockIds.length === 0) {
    return ids;
  }

  const lastIndex =
    ids.length - 1 - [...ids].reverse().findIndex((id) => highlighted.has(id));

  if (lastIndex >= ids.length - 1) {
    return ids;
  }

  const firstIndex = ids.findIndex((id) => highlighted.has(id));
  const next = ids.filter((id) => !highlighted.has(id));
  next.splice(firstIndex + 1, 0, ...blockIds);
  return next;
}

function TransferListItemLabel({
  instance,
  checkboxId,
  orderIndex,
  showOrderIndex,
}: {
  instance: LinkedInstance;
  checkboxId: string;
  orderIndex?: number;
  showOrderIndex?: boolean;
}) {
  const typeColor = typeColors[instance.type] || "#6c757d";

  return (
    <span className="instance-transfer-list-item-label">
      <span className="instance-transfer-list-item-name">
        {showOrderIndex && orderIndex !== undefined && (
          <span className="instance-transfer-list-order-index">
            {orderIndex}.
          </span>
        )}
        <FontAwesomeIcon
          icon={faCircle}
          className="instance-transfer-list-item-type-icon"
          style={{ color: typeColor }}
          aria-hidden="true"
        />
        {instance.instanceName}
        <LinkedInstanceDraftBadge
          instance={instance}
          className="linked-instance-draft-badge--inline"
        />
      </span>
      <span
        id={`${checkboxId}-meta`}
        className="instance-transfer-list-item-meta"
      >
        {instance.type} · {instance.instanceId}
      </span>
    </span>
  );
}

function TransferListColumn({
  columnId,
  title,
  instances,
  highlightedIds,
  search,
  emptyMessage,
  onSearchChange,
  onToggleHighlight,
  onToggleGroup,
  groupByType = true,
  showOrderIndex = false,
  belowSearchContent,
}: {
  columnId: string;
  title: string;
  instances: LinkedInstance[];
  highlightedIds: Set<string>;
  search: string;
  emptyMessage: string;
  onSearchChange: (value: string) => void;
  onToggleHighlight: (instanceId: string) => void;
  onToggleGroup: (instanceIds: string[], select: boolean) => void;
  groupByType?: boolean;
  showOrderIndex?: boolean;
  belowSearchContent?: React.ReactNode;
}) {
  const filteredInstances = useMemo(
    () => instances.filter((instance) => matchesSearch(instance, search)),
    [instances, search],
  );
  const orderIndexById = useMemo(
    () =>
      new Map(instances.map((instance, index) => [instance.instanceId, index + 1])),
    [instances],
  );
  const groupedInstances = useMemo(
    () => groupInstancesByType(filteredInstances),
    [filteredInstances],
  );
  const headingId = `${columnId}-heading`;
  const summaryId = `${columnId}-summary`;
  const listId = `${columnId}-list`;

  return (
    <div
      className="instance-transfer-list-column"
      role="region"
      aria-labelledby={headingId}
    >
      <div
        id={headingId}
        className="instance-transfer-list-column-header"
      >
        {title}
      </div>
      <Form.Control
        type="search"
        placeholder={`Search ${title.toLowerCase()}...`}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="instance-transfer-list-search mb-2"
        aria-label={`Search ${title.toLowerCase()} instances`}
        aria-controls={listId}
      />
      {belowSearchContent}
      <div
        id={summaryId}
        className="instance-transfer-list-summary text-muted mb-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {filteredInstances.length} shown
        {highlightedIds.size > 0
          ? `, ${highlightedIds.size} highlighted for transfer`
          : ""}
        {showOrderIndex && highlightedIds.size > 0
          ? ". Use move up/down to reorder highlighted items."
          : showOrderIndex
            ? ". Select items to reorder."
            : ""}
      </div>
      <ListGroup
        id={listId}
        className="instance-transfer-list-panel"
        aria-labelledby={headingId}
        aria-describedby={summaryId}
      >
        {filteredInstances.length === 0 ? (
          <ListGroup.Item
            as="div"
            className="instance-transfer-list-empty text-muted"
            role="status"
          >
            {emptyMessage}
          </ListGroup.Item>
        ) : groupByType ? (
          groupedInstances.map(([type, typeInstances]) => {
            const typeInstanceIds = typeInstances.map(
              (instance) => instance.instanceId,
            );
            const allTypeSelected = typeInstanceIds.every((instanceId) =>
              highlightedIds.has(instanceId),
            );
            const groupCheckboxId = `transfer-group-${columnId}-${type}`;
            const groupLabelId = `transfer-group-label-${columnId}-${type}`;

            return (
              <React.Fragment key={type}>
                <ListGroup.Item
                  as="div"
                  className="instance-transfer-list-group-header"
                  role="presentation"
                >
                  <Form.Check
                    type="checkbox"
                    id={groupCheckboxId}
                    checked={allTypeSelected}
                    onChange={() =>
                      onToggleGroup(typeInstanceIds, !allTypeSelected)
                    }
                    label={
                      <span id={groupLabelId}>
                        Select all {type} ({typeInstances.length})
                      </span>
                    }
                  />
                </ListGroup.Item>
                <div
                  role="group"
                  aria-labelledby={groupLabelId}
                  className="instance-transfer-list-type-group"
                >
                  {typeInstances.map((instance) => {
                    const isHighlighted = highlightedIds.has(
                      instance.instanceId,
                    );
                    const checkboxId = `transfer-item-${columnId}-${instance.instanceId}`;

                    return (
                      <ListGroup.Item
                        key={instance.instanceId}
                        as="div"
                        className={`instance-transfer-list-item${
                          isHighlighted
                            ? " instance-transfer-list-item--highlighted"
                            : ""
                        }${
                          instance.isDraft
                            ? " instance-transfer-list-item--draft"
                            : ""
                        }`}
                      >
                        <Form.Check
                          type="checkbox"
                          id={checkboxId}
                          checked={isHighlighted}
                          onChange={() => onToggleHighlight(instance.instanceId)}
                          aria-describedby={`${checkboxId}-meta`}
                          label={
                            <TransferListItemLabel
                              instance={instance}
                              checkboxId={checkboxId}
                            />
                          }
                        />
                      </ListGroup.Item>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          })
        ) : (
          filteredInstances.map((instance) => {
            const isHighlighted = highlightedIds.has(instance.instanceId);
            const checkboxId = `transfer-item-${columnId}-${instance.instanceId}`;
            const orderIndex = orderIndexById.get(instance.instanceId);

            return (
              <ListGroup.Item
                key={instance.instanceId}
                as="div"
                className={`instance-transfer-list-item${
                  isHighlighted
                    ? " instance-transfer-list-item--highlighted"
                    : ""
                }${
                  instance.isDraft ? " instance-transfer-list-item--draft" : ""
                }`}
              >
                <Form.Check
                  type="checkbox"
                  id={checkboxId}
                  checked={isHighlighted}
                  onChange={() => onToggleHighlight(instance.instanceId)}
                  aria-describedby={`${checkboxId}-meta`}
                  label={
                    <TransferListItemLabel
                      instance={instance}
                      checkboxId={checkboxId}
                      orderIndex={orderIndex}
                      showOrderIndex={showOrderIndex}
                    />
                  }
                />
              </ListGroup.Item>
            );
          })
        )}
      </ListGroup>
    </div>
  );
}

export default function InstanceTransferList({
  instances,
  availableInstances,
  selectedIds,
  onSelectedIdsChange,
  availableFilters,
}: InstanceTransferListProps) {
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [availableHighlighted, setAvailableHighlighted] = useState<Set<string>>(
    new Set(),
  );
  const [selectedHighlighted, setSelectedHighlighted] = useState<Set<string>>(
    new Set(),
  );

  const instanceMap = useMemo(
    () => new Map(instances.map((instance) => [instance.instanceId, instance])),
    [instances],
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const availableList = useMemo(
    () =>
      availableInstances.filter(
        (instance) => !selectedIdSet.has(instance.instanceId),
      ),
    [availableInstances, selectedIdSet],
  );

  const selectedList = useMemo(
    () =>
      selectedIds
        .map((instanceId) => instanceMap.get(instanceId))
        .filter((instance): instance is LinkedInstance => Boolean(instance)),
    [instanceMap, selectedIds],
  );

  const visibleAvailableIds = useMemo(
    () =>
      availableList
        .filter((instance) => matchesSearch(instance, availableSearch))
        .map((instance) => instance.instanceId),
    [availableList, availableSearch],
  );

  const visibleSelectedIds = useMemo(
    () =>
      selectedList
        .filter((instance) => matchesSearch(instance, selectedSearch))
        .map((instance) => instance.instanceId),
    [selectedList, selectedSearch],
  );

  const highlightedAvailableCount = [...availableHighlighted].filter((id) =>
    visibleAvailableIds.includes(id),
  ).length;

  const highlightedSelectedCount = [...selectedHighlighted].filter((id) =>
    visibleSelectedIds.includes(id),
  ).length;

  const canMoveSelectedUp = useMemo(() => {
    if (selectedHighlighted.size === 0) {
      return false;
    }

    const firstHighlightedIndex = selectedIds.findIndex((id) =>
      selectedHighlighted.has(id),
    );

    return firstHighlightedIndex > 0;
  }, [selectedHighlighted, selectedIds]);

  const canMoveSelectedDown = useMemo(() => {
    if (selectedHighlighted.size === 0) {
      return false;
    }

    const lastHighlightedIndex =
      selectedIds.length -
      1 -
      [...selectedIds].reverse().findIndex((id) => selectedHighlighted.has(id));

    return lastHighlightedIndex < selectedIds.length - 1;
  }, [selectedHighlighted, selectedIds]);

  const moveSelectedUp = () => {
    onSelectedIdsChange(moveBlockUp(selectedIds, selectedHighlighted));
  };

  const moveSelectedDown = () => {
    onSelectedIdsChange(moveBlockDown(selectedIds, selectedHighlighted));
  };

  const toggleHighlight = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    instanceId: string,
  ) => {
    setter((previous) => {
      const next = new Set(previous);

      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }

      return next;
    });
  };

  const toggleGroupHighlight = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    instanceIds: string[],
    select: boolean,
  ) => {
    setter((previous) => {
      const next = new Set(previous);

      for (const instanceId of instanceIds) {
        if (select) {
          next.add(instanceId);
        } else {
          next.delete(instanceId);
        }
      }

      return next;
    });
  };

  const moveHighlighted = (
    fromHighlighted: Set<string>,
    visibleIds: string[],
    add: boolean,
  ) => {
    const idsToMove = [...fromHighlighted].filter((instanceId) =>
      visibleIds.includes(instanceId),
    );

    if (idsToMove.length === 0) {
      return;
    }

    if (add) {
      const nextSelected = [...selectedIds];

      for (const instanceId of idsToMove) {
        if (!nextSelected.includes(instanceId)) {
          nextSelected.push(instanceId);
        }
      }

      onSelectedIdsChange(nextSelected);
      setAvailableHighlighted(new Set());
    } else {
      onSelectedIdsChange(
        selectedIds.filter((instanceId) => !idsToMove.includes(instanceId)),
      );
      setSelectedHighlighted(new Set());
    }
  };

  const moveAll = (visibleIds: string[], add: boolean) => {
    if (visibleIds.length === 0) {
      return;
    }

    if (add) {
      const nextSelected = [...selectedIds];

      for (const instanceId of visibleIds) {
        if (!nextSelected.includes(instanceId)) {
          nextSelected.push(instanceId);
        }
      }

      onSelectedIdsChange(nextSelected);
      setAvailableHighlighted(new Set());
    } else {
      onSelectedIdsChange(
        selectedIds.filter((instanceId) => !visibleIds.includes(instanceId)),
      );
      setSelectedHighlighted(new Set());
    }
  };

  return (
    <Row className="instance-transfer-list g-3">
      <Col md={5}>
        <TransferListColumn
          columnId="available"
          title="Available"
          instances={availableList}
          highlightedIds={availableHighlighted}
          search={availableSearch}
          emptyMessage="No available instances match your filters."
          onSearchChange={setAvailableSearch}
          belowSearchContent={availableFilters}
          onToggleHighlight={(instanceId) =>
            toggleHighlight(setAvailableHighlighted, instanceId)
          }
          onToggleGroup={(instanceIds, select) =>
            toggleGroupHighlight(setAvailableHighlighted, instanceIds, select)
          }
        />
      </Col>

      <Col
        md={2}
        className="instance-transfer-list-actions-col"
        role="group"
        aria-label="Transfer actions"
      >
        <div className="instance-transfer-list-actions">
          <div className="instance-transfer-list-action-group">
            <Button
              variant="outline-secondary"
              size="sm"
              className="instance-transfer-list-action-btn"
              aria-label="Add highlighted available instances to selected list"
              disabled={highlightedAvailableCount === 0}
              onClick={() =>
                moveHighlighted(
                  availableHighlighted,
                  visibleAvailableIds,
                  true,
                )
              }
            >
              <span className="instance-transfer-list-action-btn-content">
                Add
                <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
              </span>
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              className="instance-transfer-list-action-btn"
              aria-label="Add all visible available instances to selected list"
              disabled={visibleAvailableIds.length === 0}
              onClick={() => moveAll(visibleAvailableIds, true)}
            >
              <span className="instance-transfer-list-action-btn-content">
                Add all
                <FontAwesomeIcon icon={faAnglesRight} aria-hidden="true" />
              </span>
            </Button>
          </div>

          <div
            className="instance-transfer-list-action-divider"
            aria-hidden="true"
          />

          <div className="instance-transfer-list-action-group">
            <Button
              variant="outline-secondary"
              size="sm"
              className="instance-transfer-list-action-btn"
              aria-label="Remove highlighted instances from selected list"
              disabled={highlightedSelectedCount === 0}
              onClick={() =>
                moveHighlighted(selectedHighlighted, visibleSelectedIds, false)
              }
            >
              <span className="instance-transfer-list-action-btn-content">
                <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
                Remove
              </span>
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              className="instance-transfer-list-action-btn"
              aria-label="Remove all visible instances from selected list"
              disabled={visibleSelectedIds.length === 0}
              onClick={() => moveAll(visibleSelectedIds, false)}
            >
              <span className="instance-transfer-list-action-btn-content">
                <FontAwesomeIcon icon={faAnglesLeft} aria-hidden="true" />
                Remove all
              </span>
            </Button>
          </div>

          <div
            className="instance-transfer-list-action-divider"
            aria-hidden="true"
          />

          <div className="instance-transfer-list-action-group">
            <Button
              variant="outline-secondary"
              size="sm"
              className="instance-transfer-list-action-btn"
              aria-label="Move highlighted selected instances up"
              disabled={!canMoveSelectedUp}
              onClick={moveSelectedUp}
            >
              <FontAwesomeIcon icon={faChevronUp} className="me-1" />
              Move up
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              className="instance-transfer-list-action-btn"
              aria-label="Move highlighted selected instances down"
              disabled={!canMoveSelectedDown}
              onClick={moveSelectedDown}
            >
              <FontAwesomeIcon icon={faChevronDown} className="me-1" />
              Move down
            </Button>
          </div>
        </div>
      </Col>

      <Col md={5}>
        <TransferListColumn
          columnId="selected"
          title="Selected"
          instances={selectedList}
          highlightedIds={selectedHighlighted}
          search={selectedSearch}
          emptyMessage="No instances selected for this field."
          onSearchChange={setSelectedSearch}
          onToggleHighlight={(instanceId) =>
            toggleHighlight(setSelectedHighlighted, instanceId)
          }
          onToggleGroup={(instanceIds, select) =>
            toggleGroupHighlight(setSelectedHighlighted, instanceIds, select)
          }
          groupByType={false}
          showOrderIndex
        />
      </Col>
    </Row>
  );
}
