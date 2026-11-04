import React from "react";
import "./DisabledHint.css";

/**
 * Shows why a control is disabled as its tooltip. The tooltip goes on a wrapper since a disabled button gets no pointer
 * events (Bootstrap sets pointer-events: none) - the wrapper also keeps the clicks on it from reaching a clickable
 * parent (e.g. a list row).
 */
export function DisabledHint({ reason, children }: { reason?: string; children: React.ReactNode }) {
  if (!reason) {
    return <>{children}</>;
  }
  return (
    <span className="disabled-hint" title={reason} onClick={(event) => event.stopPropagation()}>
      {children}
    </span>
  );
}

/** The tooltip of a control the user may not use, e.g. noPermission("edit this instance") */
export const noPermission = (action: string) => `You don't have the permission to ${action}`;
