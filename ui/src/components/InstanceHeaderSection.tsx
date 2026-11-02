import React, { useId, useState } from "react";
import { Button, Collapse } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { DisabledHint } from "./DisabledHint";
import "./InstanceHeaderSection.css";

/**
 * A section of the instance header which isn't a property of the instance (see "instance-header-sections"). The title
 * and the summary stay visible, the content is collapsed by default. Without content, there is nothing to expand.
 */
export default function InstanceHeaderSection({
  title,
  count,
  summary,
  defaultExpanded = false,
  expanded,
  onToggle,
  disabledReason,
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
  /** Why the section can't be expanded - it stays visible, with the reason as the tooltip of its toggle */
  disabledReason?: string;
  /** Only mounts the content while expanded - it doesn't keep its state then */
  mountOnExpand?: boolean;
  children?: React.ReactNode;
}) {
  const [isExpandedInternally, setIsExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? isExpandedInternally;
  const contentId = useId();
  return (
    <section className="instance-header-section" aria-label={title}>
      <div className="instance-header-section-row">
        <h3 className="instance-header-section-title">
          {children ? (
            <DisabledHint reason={disabledReason}>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="instance-header-section-toggle p-0"
                onClick={onToggle ?? (() => setIsExpanded((previous) => !previous))}
                disabled={disabledReason !== undefined}
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
            </DisabledHint>
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
