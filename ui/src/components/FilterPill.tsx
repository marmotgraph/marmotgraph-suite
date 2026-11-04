import React from "react";
import { Badge } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

type FilterPillProps = {
  label: string;
  value: string;
  onRemove: () => void;
  className?: string;
  title?: string;
};

export function FilterPill({
  label,
  value,
  onRemove,
  className,
  title,
}: FilterPillProps) {
  return (
    <Badge
      bg="secondary"
      className={`me-2 mb-2 d-inline-flex align-items-center${className ? ` ${className}` : ""}`}
      style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
      title={title}
    >
      <span className="me-2 filter-pill-value">
        <strong>{label}:</strong> {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          padding: 0,
          marginLeft: "0.25rem",
        }}
        aria-label={`Remove ${label} filter`}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </Badge>
  );
}
