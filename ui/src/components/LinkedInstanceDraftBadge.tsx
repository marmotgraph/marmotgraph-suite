import React from "react";
import { LinkedInstance } from "../modules/editor/editorMockData";
import "./LinkedInstanceDraftBadge.css";

type LinkedInstanceDraftBadgeProps = {
  instance: Pick<LinkedInstance, "isDraft" | "isNew">;
  className?: string;
};

export default function LinkedInstanceDraftBadge({
  instance,
  className,
}: LinkedInstanceDraftBadgeProps) {
  if (!instance.isDraft) {
    return null;
  }

  return (
    <span
      className={`linked-instance-draft-badge${
        className ? ` ${className}` : ""
      }`}
    >
      {instance.isNew ? "New" : "Draft"}
    </span>
  );
}
