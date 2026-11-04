import React, { useMemo, useState } from "react";
import { Button, Dropdown, Form } from "react-bootstrap";
import "./MultiSelectFilterDropdown.css";

type MultiSelectFilterDropdownProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  menuClassName?: string;
};

export function MultiSelectFilterDropdown({
  label,
  options,
  selected,
  onChange,
  searchPlaceholder = "Search...",
  emptyMessage = "No options found",
  menuClassName,
}: MultiSelectFilterDropdownProps) {
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch === "") {
      return options;
    }

    return options.filter((option) =>
      option.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    );
  };

  const handleToggle = (nextShow: boolean) => {
    setShow(nextShow);

    if (!nextShow) {
      setSearch("");
    }
  };

  const buttonLabel =
    selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <Dropdown
      show={show}
      onToggle={handleToggle}
      autoClose="outside"
      className="multi-select-filter-dropdown"
    >
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        id={`multi-select-filter-${label.replace(/\s+/g, "-").toLowerCase()}`}
      >
        {buttonLabel}
      </Dropdown.Toggle>

      <Dropdown.Menu
        className={`multi-select-filter-dropdown-menu${menuClassName ? ` ${menuClassName}` : ""}`}
        aria-label={`${label} filter options`}
      >
        <div className="multi-select-filter-dropdown-search">
          <Form.Control
            type="search"
            size="sm"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Search ${label.toLowerCase()}`}
          />
        </div>

        <div className="multi-select-filter-dropdown-options">
          {filteredOptions.length === 0 ? (
            <div className="multi-select-filter-dropdown-empty text-muted">
              {emptyMessage}
              {search.trim() !== "" ? ` matching "${search.trim()}"` : ""}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <Dropdown.Item
                as="div"
                key={option}
                className="multi-select-filter-dropdown-option"
                onClick={(event) => event.preventDefault()}
              >
                <Form.Check
                  type="checkbox"
                  id={`multi-select-${label}-${option}`}
                  label={option}
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                />
              </Dropdown.Item>
            ))
          )}
        </div>

        {selected.length > 0 && (
          <div className="multi-select-filter-dropdown-footer">
            <Button
              variant="link"
              size="sm"
              className="multi-select-filter-dropdown-clear p-0"
              onClick={() => onChange([])}
            >
              Clear selection
            </Button>
          </div>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}
