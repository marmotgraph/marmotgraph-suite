import React from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
  ariaLabel?: string;
};

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = "Search",
  ariaLabel = "Search",
}: SearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <InputGroup>
      <Form.Control
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
      />
      <Button
        variant="dark"
        onClick={onSearch}
        aria-label="Search button"
      >
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <span className="ms-2">Search</span>
      </Button>
    </InputGroup>
  );
}
