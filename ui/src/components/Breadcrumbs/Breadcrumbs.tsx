// src/components/Breadcrumbs/Breadcrumbs.tsx
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/free-solid-svg-icons";
import "./Breadcrumbs.css";

export type BreadcrumbItem = {
  id: string;
  label: string;
  color?: string;
};

type BreadcrumbCrumb = {
  crumb: BreadcrumbItem;
  index: number;
};

const COLLAPSE_THRESHOLD = 5;

const getBreadcrumbSegments = (
  breadcrumbs: BreadcrumbItem[],
): {
  leading: BreadcrumbCrumb[];
  collapsed: BreadcrumbCrumb[];
  trailing: BreadcrumbCrumb[];
  current: BreadcrumbItem;
} => {
  const lastIndex = breadcrumbs.length - 1;

  if (breadcrumbs.length < COLLAPSE_THRESHOLD) {
    return {
      leading: breadcrumbs.slice(0, lastIndex).map((crumb, index) => ({
        crumb,
        index,
      })),
      collapsed: [],
      trailing: [],
      current: breadcrumbs[lastIndex],
    };
  }

  return {
    leading: [{ crumb: breadcrumbs[0], index: 0 }],
    collapsed: breadcrumbs.slice(1, lastIndex - 1).map((crumb, offset) => ({
      crumb,
      index: offset + 1,
    })),
    trailing: [{ crumb: breadcrumbs[lastIndex - 1], index: lastIndex - 1 }],
    current: breadcrumbs[lastIndex],
  };
};

const BreadcrumbSeparator = () => (
  <span className="breadcrumb-separator" aria-hidden="true">
    &gt;
  </span>
);

const BreadcrumbLabel = ({
  label,
  color,
  isCurrent,
}: {
  label: string;
  color?: string;
  isCurrent?: boolean;
}) => (
  <span className="breadcrumb-label">
    {color && (
      <FontAwesomeIcon
        icon={faCircle}
        className="breadcrumb-dot"
        style={{ color }}
      />
    )}
    <span
      className={`breadcrumb-text${isCurrent ? " is-current" : ""}`}
      title={label}
    >
      {label}
    </span>
  </span>
);

const BreadcrumbLink = ({
  item,
  onClick,
}: {
  item: BreadcrumbCrumb;
  onClick: (item: BreadcrumbItem, index: number) => void;
}) => (
  <button
    type="button"
    className="breadcrumb-link"
    onClick={() => onClick(item.crumb, item.index)}
  >
    <BreadcrumbLabel label={item.crumb.label} color={item.crumb.color} />
  </button>
);

const BreadcrumbEllipsisMenu = ({
  items,
  onClick,
}: {
  items: BreadcrumbCrumb[];
  onClick: (item: BreadcrumbItem, index: number) => void;
}) => {
  const menuId = useId();
  const wrapperRef = useRef<HTMLLIElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setIsOpen(true);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [clearCloseTimer]);

  const toggleMenu = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, isOpen]);

  const handleItemClick = (crumb: BreadcrumbItem, index: number) => {
    closeMenu();
    onClick(crumb, index);
  };

  return (
    <li
      className="breadcrumb-item breadcrumb-item--ellipsis"
      ref={wrapperRef}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="breadcrumb-ellipsis"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Show ${items.length} hidden items`}
        onClick={toggleMenu}
      >
        …
      </button>
      {isOpen && (
        <ul className="breadcrumb-menu" id={menuId} role="menu">
          {items.map(({ crumb, index }) => (
            <li key={crumb.id} role="none">
              <button
                type="button"
                className="breadcrumb-menu-item"
                role="menuitem"
                title={crumb.label}
                onClick={() => handleItemClick(crumb, index)}
              >
                <BreadcrumbLabel label={crumb.label} color={crumb.color} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <BreadcrumbSeparator />
    </li>
  );
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  onItemClick?: (item: BreadcrumbItem, index: number) => void;
  className?: string;
};

export default function Breadcrumbs({
  items,
  onItemClick,
  className,
}: BreadcrumbsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const { leading, collapsed, trailing, current } =
    getBreadcrumbSegments(items);

  return (
    <nav
      className={`breadcrumbs${className ? ` ${className}` : ""}`}
      aria-label="Breadcrumb"
    >
      <ol className="breadcrumb-list">
        {leading.map((item) => (
          <li key={item.crumb.id} className="breadcrumb-item">
            <BreadcrumbLink item={item} onClick={onItemClick} />
            <BreadcrumbSeparator />
          </li>
        ))}
        {collapsed.length > 0 && (
          <BreadcrumbEllipsisMenu items={collapsed} onClick={onItemClick} />
        )}
        {trailing.map((item) => (
          <li key={item.crumb.id} className="breadcrumb-item">
            <BreadcrumbLink item={item} onClick={onItemClick} />
            <BreadcrumbSeparator />
          </li>
        ))}
        <li className="breadcrumb-item breadcrumb-item--current">
          <span className="breadcrumb-current" aria-current="page">
            <BreadcrumbLabel
              label={current.label}
              color={current.color}
              isCurrent
            />
          </span>
        </li>
      </ol>
    </nav>
  );
}
