import React, { useId, useState } from "react";
import { Button, Collapse } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import "./InstanceHeaderSection.css";

/**
 * A section of the instance which isn't a property of it (see "instance-header-sections"). The title and the summary
 * stay visible, the content is collapsed by default. Without content, there is nothing to expand.
 */
export default function InstanceHeaderSection({
  title,
  count,
  summary,
  defaultExpanded = false,
  expanded,
  onToggle,
  mountOnExpand = false,
  children,
}: {
  title: string;
  /** Tells how much the section holds - part of the toggle */
  count?: React.ReactNode;
  /** Stays visible next to the title, also while the section is collapsed */
  summary?: React.ReactNode;
  defaultExpanded?: boolean;
  /** Whether the section is expanded - if decided by the parent (together with onToggle) */
  expanded?: boolean;
  onToggle?: () => void;
  /** Only mounts the content while expanded - it doesn't keep its state then */
  mountOnExpand?: boolean;
  children?: React.ReactNode;
}) {
  const [internallyExpanded, setInternallyExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internallyExpanded;
  const contentId = useId();
  return (
    <section className="instance-header-section" aria-label={title}>
      <div className="instance-header-section-row">
        <h3 className="instance-header-section-title">
          {children ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="instance-header-section-toggle p-0"
              onClick={onToggle ?? (() => setInternallyExpanded((previous) => !previous))}
              aria-expanded={isExpanded}
              aria-controls={contentId}
            >
              {title} {count}
              <FontAwesomeIcon
                icon={isExpanded ? faChevronUp : faChevronDown}
                className="ms-2 instance-header-section-toggle-icon"
                aria-hidden="true"
              />
            </Button>
          ) : (
            <>
              {title} {count}
            </>
          )}
        </h3>
        {summary && <div className="instance-header-section-summary">{summary}</div>}
      </div>
      {children && (
        <Collapse in={isExpanded} mountOnEnter={mountOnExpand} unmountOnExit={mountOnExpand}>
          <div id={contentId}>
            <div className="instance-header-section-content">{children}</div>
          </div>
        </Collapse>
      )}
    </section>
  );
}
