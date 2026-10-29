import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHourglassHalf,
  faPenToSquare,
  faRocket,
  faUserPen,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { InstanceValidation, ReleaseStatus } from "../modules/editor/editorMockData";
import { ValidationStatus } from "./InstanceValidation";
import "./InstanceStatusTags.css";

const RELEASE_STATUS_TAGS: Record<
  ReleaseStatus,
  { modifier: string; icon: IconDefinition }
> = {
  released: { modifier: "released", icon: faRocket },
  "has changed": { modifier: "changed", icon: faPenToSquare },
  "in progress": { modifier: "progress", icon: faHourglassHalf },
};

/**
 * The release status of an instance, whether the user has contributed to it,
 * and — when given — the compliance of each validation schema.
 */
export function InstanceStatusTags({
  releaseStatus,
  contributed = false,
  validation,
}: {
  releaseStatus: ReleaseStatus;
  contributed?: boolean;
  validation?: InstanceValidation[];
}) {
  const { modifier, icon } = RELEASE_STATUS_TAGS[releaseStatus];
  return (
    <div className="instance-status">
      <span className={`instance-card-status instance-card-status--${modifier}`}>
        <FontAwesomeIcon icon={icon} />
        {releaseStatus}
      </span>
      {contributed && (
        <span
          className="instance-card-status instance-card-status--contribution"
          title="You have contributed to this instance"
        >
          <FontAwesomeIcon icon={faUserPen} />
          my contribution
        </span>
      )}
      {validation && validation.length > 0 && (
        <div className="instance-validation-badges">
          {validation.map((result) => (
            <ValidationStatus
              key={result.name}
              validation={result}
              variant="badge"
            />
          ))}
        </div>
      )}
    </div>
  );
}
