import React from "react";
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCode,
  faDiagramProject,
  faEye,
  faGear,
  faPen,
  faRocket,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Instance } from "../modules/editor/editorMockData";
import "./InstanceTableActions.css";

type InstanceTableActionsProps = {
  instanceId: string;
  permissions: string;
  releaseStatus: Instance["releaseStatus"];
  onAction: (actionKey: string, path: string) => void;
};

type ActionContext = {
  permissions: string;
  releaseStatus: Instance["releaseStatus"];
};

type ActionConfig = {
  key: string;
  icon: IconDefinition;
  label: string;
  path: string;
  isDisabled?: (context: ActionContext) => boolean;
  disabledTitle?: string | ((context: ActionContext) => string);
};

const actions: ActionConfig[] = [
  {
    key: "view",
    icon: faEye,
    label: "View",
    path: "",
  },
  {
    key: "edit",
    icon: faPen,
    label: "Edit",
    path: "?edit=true",
    isDisabled: ({ permissions }) => !permissions.includes("Edit"),
    disabledTitle: "Edit permission required",
  },
  {
    key: "release",
    icon: faRocket,
    label: "Release",
    path: "?release=true",
    isDisabled: ({ permissions, releaseStatus }) =>
      !permissions.includes("Release") || releaseStatus === "released",
    disabledTitle: ({ permissions, releaseStatus }) => {
      if (releaseStatus === "released") {
        return "Already released";
      }
      if (!permissions.includes("Release")) {
        return "Release permission required";
      }
      return "Release";
    },
  },
  {
    key: "graph",
    icon: faDiagramProject,
    label: "Graph view",
    path: "/visualizer",
  },
  {
    key: "raw",
    icon: faCode,
    label: "Raw data",
    path: "?view=raw",
  },
  {
    key: "settings",
    icon: faGear,
    label: "Settings",
    path: "?view=settings",
  },
];

export function InstanceTableActions({
  instanceId,
  permissions,
  releaseStatus,
  onAction,
}: InstanceTableActionsProps) {
  const basePath = `/instances/${instanceId}`;
  const context: ActionContext = { permissions, releaseStatus };

  const resolvePath = (action: ActionConfig) => {
    if (action.key === "graph") {
      return `${action.path}?instanceId=${encodeURIComponent(instanceId)}`;
    }
    if (action.path.startsWith("?")) {
      return `${basePath}${action.path}`;
    }
    return basePath;
  };

  return (
    <div
      className="instance-table-actions"
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action) => {
        const disabled = action.isDisabled?.(context) ?? false;
        const disabledTitle =
          typeof action.disabledTitle === "function"
            ? action.disabledTitle(context)
            : action.disabledTitle;
        const title = disabled && disabledTitle ? disabledTitle : action.label;

        return (
          <span key={action.key} className="instance-table-actions-item">
            <Button
              variant="link"
              size="sm"
              className="instance-table-actions-btn"
              disabled={disabled}
              title={title}
              aria-label={action.label}
              onClick={() => {
                if (!disabled) {
                  onAction(action.key, resolvePath(action));
                }
              }}
            >
              <FontAwesomeIcon icon={action.icon} aria-hidden />
            </Button>
          </span>
        );
      })}
    </div>
  );
}
