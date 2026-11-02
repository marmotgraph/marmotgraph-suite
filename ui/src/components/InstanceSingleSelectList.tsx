import React, { useId, useMemo, useState } from "react";
import { Button, Form, ListGroup } from "react-bootstrap";
import {
  LinkedInstance,
  linkedInstanceDisplayName,
} from "../modules/editor/editorMockData";
import { matchesSearch, TransferListItemLabel } from "./InstanceTransferList";
import "./InstanceTransferList.css";
import "./InstanceSingleSelectList.css";

type InstanceSingleSelectListProps = {
  instances: LinkedInstance[];
  /** The selected instance - it is listed even if it is not part of the instances (e.g. if they are filtered) */
  selected?: LinkedInstance;
  onSelect: (instanceId: string | null) => void;
  emptyMessage: string;
  filters?: React.ReactNode;
};

export default function InstanceSingleSelectList({
  instances,
  selected,
  onSelect,
  emptyMessage,
  filters,
}: InstanceSingleSelectListProps) {
  const [search, setSearch] = useState("");
  const groupName = useId();
  const filteredInstances = useMemo(() => {
    const listed =
      selected && !instances.some((instance) => instance.instanceId === selected.instanceId)
        ? [selected, ...instances]
        : instances;
    return listed.filter((instance) => matchesSearch(instance, search));
  }, [instances, search, selected]);

  return (
    <div className="instance-single-select-list">
      {filters}

      <Form.Control
        type="search"
        placeholder="Search instances..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="instance-transfer-list-search mb-2"
        aria-label="Search instances"
      />
      <div className="instance-single-select-list-summary mb-2">
        <span className="instance-transfer-list-summary text-muted" aria-live="polite">
          {filteredInstances.length} shown
        </span>
        {selected && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="instance-single-select-list-clear p-0"
            onClick={() => onSelect(null)}
          >
            Clear selection
          </Button>
        )}
      </div>
      <ListGroup
        className="instance-transfer-list-panel"
        role="radiogroup"
        aria-label="Instances"
      >
        {filteredInstances.length === 0 ? (
          <ListGroup.Item
            as="div"
            className="instance-transfer-list-empty text-muted"
            role="status"
          >
            {emptyMessage}
          </ListGroup.Item>
        ) : (
          filteredInstances.map((instance) => {
            const isSelected = instance.instanceId === selected?.instanceId;
            const radioId = `${groupName}-${instance.instanceId}`;

            return (
              <ListGroup.Item
                key={instance.instanceId}
                as="div"
                className={`instance-transfer-list-item${
                  isSelected ? " instance-transfer-list-item--highlighted" : ""
                }${instance.isDraft ? " instance-transfer-list-item--draft" : ""}`}
                onClick={() => onSelect(instance.instanceId)}
              >
                <Form.Check
                  type="radio"
                  id={radioId}
                  name={groupName}
                  checked={isSelected}
                  onChange={() => onSelect(instance.instanceId)}
                  aria-describedby={`${radioId}-meta`}
                  label={
                    <TransferListItemLabel
                      instance={{
                        ...instance,
                        instanceName: linkedInstanceDisplayName(instance),
                      }}
                      checkboxId={radioId}
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
