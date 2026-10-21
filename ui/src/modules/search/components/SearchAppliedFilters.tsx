import React from "react";
import { X } from "lucide-react";
import type { SearchFilters } from "../types/searchTypes";
import "./SearchAppliedFilters.css";

type SearchAppliedFiltersProps = {
  filters: SearchFilters;
  onRemove: (dimension: "types" | "spaces", value: string) => void;
  onClearAll: () => void;
};

export function SearchAppliedFilters({
  filters,
  onRemove,
  onClearAll,
}: SearchAppliedFiltersProps) {
  const chips = [
    ...filters.types.map((value) => ({
      dimension: "types" as const,
      value,
      label: `Type: ${value}`,
    })),
    ...filters.spaces.map((value) => ({
      dimension: "spaces" as const,
      value,
      label: `Space: ${value}`,
    })),
  ];

  if (chips.length === 0) return null;

  return (
    <div className="search-applied" role="region" aria-label="Applied filters">
      <span className="search-applied-label">Active</span>
      {chips.map((chip) => (
        <button
          key={`${chip.dimension}-${chip.value}`}
          type="button"
          className="search-applied-chip"
          onClick={() => onRemove(chip.dimension, chip.value)}
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <X size={14} aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        className="search-applied-chip search-applied-chip--clear"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  );
}
