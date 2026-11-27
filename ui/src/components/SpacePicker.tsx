import React, { useEffect, useId, useRef, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { findSpace, spaceLabel, useQuerySpaces } from "../modules/query-builder/useQueryBuilderData";
import type { QuerySpace } from "../services/queries";

/** How many matching spaces are mounted. The rest stay out of the document. */
export const SPACE_PICKER_LIMIT = 50;

/** A shorter list is shown as it is — the search is for lists too long to scan. */
export const SPACE_SEARCH_FROM = 8;

/** The space the instance is in. An empty value is the private space of the user. */
export function isCurrentSpace(space: QuerySpace, value: string): boolean {
  if (!value || value === "myspace") {
    return space.isPrivate;
  }
  return space.identifier === value;
}

/**
 * Spaces the instance can be saved in: those the user can create instances in, plus the one it is in
 * (so it stays selectable when they can edit it but not create another there).
 */
export function spacesToOffer(spaces: QuerySpace[], current: string): QuerySpace[] {
  const offered = spaces.filter((space) => space.canCreate || isCurrentSpace(space, current));
  if (current && !offered.some((space) => isCurrentSpace(space, current))) {
    return [{ identifier: current, isPrivate: false, canCreate: false, canWrite: false, canDelete: false }, ...offered];
  }
  return offered;
}

/**
 * The matches for a query, capped so a long list of spaces does not mount every option.
 * The current space stays in the window when it matches, even if it would otherwise fall past the cap.
 */
export function windowSpaces(
  spaces: QuerySpace[],
  query: string,
  current: string,
  limit = SPACE_PICKER_LIMIT,
): { visible: QuerySpace[]; total: number } {
  const needle = query.trim().toLowerCase();
  const visible: QuerySpace[] = [];
  let total = 0;
  let selected: QuerySpace | undefined;
  for (const space of spaces) {
    const label = spaceLabel(space).toLowerCase();
    if (needle && !label.includes(needle) && !space.identifier.toLowerCase().includes(needle)) {
      continue;
    }
    total += 1;
    if (isCurrentSpace(space, current)) {
      selected = space;
    }
    if (visible.length < limit) {
      visible.push(space);
    }
  }
  if (selected && !visible.includes(selected)) {
    visible.pop();
    visible.unshift(selected);
  }
  return { visible, total };
}

function spaceText(value: string): string {
  if (!value) {
    return "My private space";
  }
  return value;
}

/** The space as text — used when it cannot be changed. */
export function SpaceText({
  value,
  note,
}: {
  value: string;
  note?: string;
}) {
  const shown = spaceText(value);
  return (
    <div className="instance-space-block">
      <div className="instance-space-line">
        <span className="instance-space-value" title={shown}>
          <strong>Space:</strong> {shown}
        </span>
      </div>
      {note && <p className="instance-space-note">{note}</p>}
    </div>
  );
}

/**
 * Picks the space an instance is saved in. Only a window of matches is mounted, with a search once the
 * list is long, so a user who can write to many spaces can still find one.
 */
export function SpacePicker({
  spaces,
  value,
  onChange,
  disabled = false,
  disabledReason,
}: {
  spaces: QuerySpace[];
  value: string;
  onChange: (space: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const labelId = useId();
  const valueId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const searchable = spaces.length > SPACE_SEARCH_FROM;
  const { visible, total } = windowSpaces(spaces, query, value);
  const current = findSpace(spaces, value) ?? (value ? undefined : spaces.find((space) => space.isPrivate));
  const label = current ? spaceLabel(current) : spaceText(value);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (searchable) {
      searchRef.current?.focus();
      return;
    }
    rootRef.current?.querySelector<HTMLElement>("[data-active='true']")?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) {
      return;
    }
    rootRef.current?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView?.({ block: "nearest" });
  }, [active, open, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
    toggleRef.current?.focus();
  };

  const choose = (space: QuerySpace) => {
    close();
    if (!isCurrentSpace(space, value)) {
      onChange(space.identifier);
    }
  };

  const openMenu = () => {
    if (disabled) {
      return;
    }
    const index = windowSpaces(spaces, "", value).visible.findIndex((space) => isCurrentSpace(space, value));
    setQuery("");
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (visible.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(visible.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const space = visible[Math.min(active, visible.length - 1)];
      if (space) {
        choose(space);
      }
    }
  };

  let status: string | undefined;
  if (total === 0) {
    status = `No spaces match “${query.trim()}”`;
  } else if (visible.length < total) {
    status = `Showing ${visible.length} of ${total}. Keep typing to narrow the list.`;
  } else if (query.trim()) {
    status = `${total} of ${spaces.length}`;
  }
  const activeIndex = visible.length === 0 ? 0 : Math.min(active, visible.length - 1);
  const activeId = visible.length > 0 ? `${listId}-option-${activeIndex}` : undefined;

  return (
    <div className="instance-space-block" ref={rootRef}>
      <div className="instance-space">
      <span id={labelId} className="instance-space-label">
        <strong>Space:</strong>
      </span>
      <div className="instance-space-picker">
        <button
          type="button"
          ref={toggleRef}
          className="instance-space-picker-toggle"
          aria-labelledby={`${labelId} ${valueId}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          disabled={disabled}
          title={disabledReason}
          onClick={() => (open ? close() : openMenu())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              openMenu();
            }
          }}
        >
          <span id={valueId} className="instance-space-picker-value">
            {label}
          </span>
          <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
        </button>
        {open && (
          <div className="instance-space-menu" onKeyDown={onMenuKeyDown}>
            {searchable && (
              <Form.Control
                ref={searchRef}
                type="search"
                size="sm"
                className="instance-space-menu-search"
                placeholder="Search spaces"
                aria-label="Search spaces"
                aria-controls={listId}
                aria-activedescendant={activeId}
                autoComplete="off"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
              />
            )}
            {status && (
              <div className="instance-space-menu-status" role="status">
                {status}
              </div>
            )}
            <ul
              id={listId}
              role="listbox"
              aria-label="Spaces"
              className="instance-space-menu-list"
              tabIndex={searchable ? -1 : 0}
              aria-activedescendant={searchable ? undefined : activeId}
            >
              {visible.map((space, index) => {
                const selected = isCurrentSpace(space, value);
                return (
                  <li key={space.identifier} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-option-${index}`}
                      role="option"
                      className="instance-space-menu-option"
                      aria-selected={selected}
                      data-active={index === activeIndex}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(space)}
                    >
                      {spaceLabel(space)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      </div>
      {disabled && disabledReason && <p className="instance-space-note">{disabledReason}</p>}
    </div>
  );
}

function sameSpace(spaces: QuerySpace[], left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  return spaces.some((space) => isCurrentSpace(space, left) && isCurrentSpace(space, right));
}

function labelOf(spaces: QuerySpace[], value: string): string {
  const current = findSpace(spaces, value) ?? (value ? undefined : spaces.find((space) => space.isPrivate));
  return current ? spaceLabel(current) : spaceText(value);
}

/** Confirms a space already chosen in the dropdown. The choice is kept until the instance is saved. */
function ChangeSpaceDialog({
  spaces,
  from,
  to,
  onCancel,
  onConfirm,
}: {
  spaces: QuerySpace[];
  from: string;
  to: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      show
      onHide={onCancel}
      centered
      animation={false}
      aria-labelledby="change-space-title"
      aria-describedby="change-space-description"
    >
      <Modal.Header closeButton>
        <Modal.Title id="change-space-title">Change space</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p id="change-space-description" className="mb-0">
          The space changes from <strong>{labelOf(spaces, from)}</strong> to{" "}
          <strong>{labelOf(spaces, to)}</strong>. Save the instance to apply this change.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button type="button" variant="outline-secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="dark" onClick={onConfirm}>
          Change space
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/**
 * The space of an instance being edited. The dropdown lists the spaces the user can create instances in.
 * Choosing another one asks for confirmation, and the choice is kept until the instance is saved.
 * Spaces are loaded here, and kept for the session.
 */
export function InstanceSpaceEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (space: string) => void;
}) {
  const { data, error } = useQuerySpaces();
  const [pending, setPending] = useState<string | undefined>();
  if (error) {
    return <SpaceText value={value} note="Spaces could not be loaded." />;
  }
  if (!data) {
    return <SpaceText value={value} note="Loading spaces…" />;
  }
  const offered = spacesToOffer(data, value);
  const alternatives = offered.filter((space) => !isCurrentSpace(space, value));
  if (alternatives.length === 0) {
    return <SpaceText value={labelOf(data, value)} />;
  }
  return (
    <>
      <SpacePicker
        spaces={offered}
        value={value}
        onChange={(space) => {
          if (!sameSpace(offered, space, value)) {
            setPending(space);
          }
        }}
      />
      {pending !== undefined && (
        <ChangeSpaceDialog
          spaces={offered}
          from={value}
          to={pending}
          onCancel={() => setPending(undefined)}
          onConfirm={() => {
            onChange(pending);
            setPending(undefined);
          }}
        />
      )}
    </>
  );
}
