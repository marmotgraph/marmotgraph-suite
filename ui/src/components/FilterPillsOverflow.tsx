import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { FilterPill } from "./FilterPill";
import "./FilterPillsOverflow.css";

type FilterPillsOverflowProps = {
  label: string;
  values: string[];
  onRemove: (value: string) => void;
  onClearAll?: () => void;
  maxVisible?: number;
  formatValue?: (value: string) => string;
};

export function FilterPillsOverflow({
  label,
  values,
  onRemove,
  onClearAll,
  maxVisible = 2,
  formatValue = (value) => value,
}: FilterPillsOverflowProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (values.length <= maxVisible) {
      setExpanded(false);
    }
  }, [maxVisible, values.length]);

  if (values.length === 0) {
    return null;
  }

  const hasOverflow = values.length > maxVisible;
  const hiddenCount = values.length - maxVisible;
  const visibleValues =
    expanded || !hasOverflow ? values : values.slice(0, maxVisible);

  return (
    <div className="filter-pills-overflow">
      <div className="filter-pills-overflow-header">
        <span className="filter-pills-overflow-label">{label}</span>
        <span className="filter-pills-overflow-count">{values.length}</span>
        {onClearAll && (
          <Button
            variant="link"
            size="sm"
            className="filter-pills-overflow-clear p-0"
            onClick={onClearAll}
          >
            Clear
          </Button>
        )}
      </div>

      <div
        className={`filter-pills-overflow-list${
          expanded ? " filter-pills-overflow-list--expanded" : ""
        }`}
      >
        {visibleValues.map((value) => {
          const displayValue = formatValue(value);

          return (
            <FilterPill
              key={value}
              label={label}
              value={displayValue}
              title={displayValue !== value ? value : undefined}
              onRemove={() => onRemove(value)}
              className="filter-pill-compact"
            />
          );
        })}

        {hasOverflow && !expanded && (
          <Button
            variant="link"
            size="sm"
            className="filter-pills-overflow-toggle p-0"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
          >
            +{hiddenCount} more
          </Button>
        )}

        {hasOverflow && expanded && (
          <Button
            variant="link"
            size="sm"
            className="filter-pills-overflow-toggle p-0"
            onClick={() => setExpanded(false)}
            aria-expanded={true}
          >
            Show less
          </Button>
        )}
      </div>
    </div>
  );
}

function truncateMiddle(value: string, maxLength = 28): string {
  if (value.length <= maxLength) {
    return value;
  }

  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 1) / 2);

  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatSpaceFilterValue(value: string): string {
  return truncateMiddle(value, 32);
}
