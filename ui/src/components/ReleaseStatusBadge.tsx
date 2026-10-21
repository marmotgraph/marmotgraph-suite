import React from "react";
import { Badge } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faClock } from "@fortawesome/free-solid-svg-icons";
import type { Instance } from "../modules/editor/editorMockData";
import "./ReleaseStatusBadge.css";

type ReleaseStatusBadgeProps = {
  status: Instance["releaseStatus"];
};

export function ReleaseStatusBadge({ status }: ReleaseStatusBadgeProps) {
  if (status === "released") {
    return (
      <Badge
        pill
        bg=""
        className="release-status-badge release-status-badge--released"
        aria-label="Released"
      >
        <FontAwesomeIcon icon={faCheck} className="me-1" aria-hidden />
        Released
      </Badge>
    );
  }

  return (
    <Badge
      pill
      bg=""
      className="release-status-badge release-status-badge--in-progress"
      aria-label="In progress"
    >
      <FontAwesomeIcon icon={faClock} className="me-1" aria-hidden />
      In progress
    </Badge>
  );
}
