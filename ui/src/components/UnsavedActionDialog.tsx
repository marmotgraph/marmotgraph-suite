import React from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircle,
  faFloppyDisk,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { UnsavedInstanceDraft } from "../contexts/UnsavedInstancesContext";
import { getChangedInstanceFieldKeys } from "../modules/editor/editorMockData";
import "./UnsavedInstancesPanel.css";

const typeColors: Record<string, string> = {
  Appliance: "#ff9800",
  "Asset Tag": "#9c27b0",
  Blade: "#2196f3",
  Building: "#4caf50",
  Cabinet: "#f44336",
  Canton: "#00bcd4",
};

export type UnsavedAction = "save" | "cancel";
export type UnsavedActionScope = "one" | "selected" | "all";

const TITLES: Record<UnsavedAction, Record<UnsavedActionScope, string>> = {
  save: { all: "Save all changes?", selected: "Save selected changes?", one: "Save these changes?" },
  cancel: { all: "Cancel all unsaved changes?", selected: "Cancel selected changes?", one: "Cancel unsaved changes?" },
};

const CONFIRM_LABELS: Record<UnsavedAction, Record<UnsavedActionScope, string>> = {
  save: { all: "Save all", selected: "Save selected", one: "Save" },
  cancel: { all: "Cancel all", selected: "Cancel selected", one: "Cancel changes" },
};

/** The scope of the instances chosen - all of them, a selection of several, or a single one */
const chosenScope = (chosen: number, total: number): UnsavedActionScope => {
  if (chosen <= 1) {
    return "one";
  }
  return chosen === total ? "all" : "selected";
};

type ChangeSummary = {
  label: string;
  detail?: string;
};

type DraftNotice = {
  message: string;
  blocksSave: boolean;
};

type UnsavedActionDialogProps = {
  show: boolean;
  action: UnsavedAction;
  /** Scope chosen when the dialog opened. A single instance keeps it. */
  scope: UnsavedActionScope;
  drafts: UnsavedInstanceDraft[];
  offeredIds: string[];
  includedIds: string[];
  saveErrors?: Record<string, string>;
  typeColorFor?: (draft: UnsavedInstanceDraft) => string | undefined;
  /** Label of a field on a draft, so a linked draft can name the field it comes from. */
  linkFieldLabel?: (draftId: string, fieldKey: string) => string | undefined;
  onToggle: (instanceId: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
};

export type LinkedDraft = {
  draft: UnsavedInstanceDraft;
  fromName: string;
  fieldLabel?: string;
};

type FoundLink = {
  instanceId: string;
  fieldLabel?: string;
};

function collectLinks(value: unknown, fieldLabel: string | undefined, links: FoundLink[], depth = 0) {
  if (depth > 8 || value == null) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectLinks(item, fieldLabel, links, depth + 1));
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.instanceId === "string" && record.instanceId && (record.instanceName || record.type)) {
    links.push({ instanceId: record.instanceId, fieldLabel });
    return;
  }
  if (Array.isArray(record.fields)) {
    record.fields.forEach((field) => {
      if (!field || typeof field !== "object") {
        return;
      }
      const nested = field as { label?: unknown; value?: unknown };
      const label = typeof nested.label === "string" ? nested.label : fieldLabel;
      collectLinks(nested.value, label, links, depth + 1);
    });
  }
}

function linksInDraft(
  draft: UnsavedInstanceDraft,
  fieldLabel?: (draftId: string, fieldKey: string) => string | undefined,
): FoundLink[] {
  const links: FoundLink[] = [];
  Object.entries(draft.fieldValues).forEach(([key, value]) => {
    collectLinks(value, fieldLabel?.(draft.instanceId, key), links);
  });
  if (draft.rawJson) {
    try {
      collectLinks(JSON.parse(draft.rawJson), undefined, links);
    } catch {
      // Invalid JSON is already reported as a notice.
    }
  }
  return links;
}

/** Instance ids this draft links to, from its field values and raw JSON. */
export function linkedInstanceIds(draft: UnsavedInstanceDraft): string[] {
  const ids = new Set<string>();
  linksInDraft(draft).forEach((link) => ids.add(link.instanceId));
  return [...ids];
}

/** Unsaved drafts reachable through links, starting from the instances being saved. */
export function linkedUnsavedDrafts(
  roots: UnsavedInstanceDraft[],
  drafts: UnsavedInstanceDraft[],
  fieldLabel?: (draftId: string, fieldKey: string) => string | undefined,
): LinkedDraft[] {
  const byId = new Map(drafts.map((draft) => [draft.instanceId, draft]));
  const seen = new Set(roots.map((draft) => draft.instanceId));
  const found: LinkedDraft[] = [];
  const queue = [...roots];
  while (queue.length > 0) {
    const draft = queue.shift();
    if (!draft) {
      break;
    }
    linksInDraft(draft, fieldLabel).forEach((link) => {
      if (seen.has(link.instanceId)) {
        return;
      }
      const linked = byId.get(link.instanceId);
      if (!linked) {
        return;
      }
      seen.add(link.instanceId);
      found.push({ draft: linked, fromName: draft.instanceName, fieldLabel: link.fieldLabel });
      queue.push(linked);
    });
  }
  return found;
}

/** Linked drafts are saved before the instances that point at them. */
export function orderDraftsForSave(
  drafts: UnsavedInstanceDraft[],
  includedIds: string[],
): UnsavedInstanceDraft[] {
  const included = new Set(includedIds);
  const byId = new Map(
    drafts.filter((draft) => included.has(draft.instanceId)).map((draft) => [draft.instanceId, draft]),
  );
  const remaining = new Set(byId.keys());
  const ordered: UnsavedInstanceDraft[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) =>
      linksInDraft(byId.get(id)!).every((link) => link.instanceId === id || !remaining.has(link.instanceId)),
    );
    const nextId = ready[0] ?? [...remaining][0];
    remaining.delete(nextId);
    const draft = byId.get(nextId);
    if (draft) {
      ordered.push(draft);
    }
  }
  return ordered;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function linkedLeftOutMessage(leftOut: LinkedDraft[]): string {
  const fresh = leftOut.filter((item) => item.draft.isNew);
  const edited = leftOut.filter((item) => !item.draft.isNew);
  const parts = [
    `${countLabel(leftOut.length, "linked instance is", "linked instances are")} still unsaved and not part of this save.`,
  ];
  if (fresh.length === 1) {
    parts.push(`${fresh[0].draft.instanceName} has not been stored, so this link points at a draft.`);
  } else if (fresh.length > 1) {
    parts.push(
      `${joinNames(fresh.map((item) => item.draft.instanceName))} have not been stored, so these links point at drafts.`,
    );
  }
  if (edited.length === 1) {
    parts.push(`${edited[0].draft.instanceName} still has unsaved changes.`);
  } else if (edited.length > 1) {
    parts.push(`${joinNames(edited.map((item) => item.draft.instanceName))} still have unsaved changes.`);
  }
  return parts.join(" ");
}

function formatChangeValue(value: unknown): string {
  if (value == null || value === "") {
    return "Empty";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") {
          return String(item);
        }
        if (item && typeof item === "object" && "instanceName" in item) {
          const name = (item as { instanceName?: unknown }).instanceName;
          return typeof name === "string" ? name : "";
        }
        return "";
      })
      .filter((part) => part !== "");
    return parts.length > 0 ? parts.join(", ") : `${value.length} values`;
  }
  return "Updated";
}

function changeSummary(draft: UnsavedInstanceDraft): ChangeSummary[] {
  if (draft.rawJson !== undefined) {
    return [{ label: "Raw JSON", detail: "The whole document will be replaced" }];
  }
  const hasBaseline = draft.baseline !== undefined;
  const keys = hasBaseline
    ? getChangedInstanceFieldKeys(draft.fieldValues, draft.baseline ?? {})
    : Object.keys(draft.fieldValues);
  const labels = draft.changedFieldLabels ?? [];
  if (keys.length === 0) {
    return labels.map((label) => ({ label }));
  }
  const labeled = labels.length === keys.length;
  return keys.map((key, index) => {
    const label = labeled ? labels[index] : key;
    const next = formatChangeValue(draft.fieldValues[key]);
    if (!hasBaseline) {
      return { label, detail: next };
    }
    const previous = formatChangeValue(draft.baseline?.[key]);
    return previous === next ? { label } : { label, detail: `${previous} → ${next}` };
  });
}

function parseRawInstance(rawJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("The instance needs to be a valid JSON object.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The instance needs to be a valid JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function draftNotices(
  draft: UnsavedInstanceDraft,
  action: UnsavedAction,
  saveError?: string,
): DraftNotice[] {
  const notices: DraftNotice[] = [];
  if (saveError) {
    notices.push({ message: saveError, blocksSave: false });
  }
  if (draft.rawJson !== undefined) {
    try {
      parseRawInstance(draft.rawJson);
    } catch (error) {
      notices.push({
        message: error instanceof Error ? error.message : "The raw JSON is not a valid object.",
        blocksSave: action === "save",
      });
    }
    if (action === "save") {
      notices.push({ message: "Saving replaces the whole stored document.", blocksSave: false });
    }
  } else if (draft.isNew && !draft.typeIdentifier) {
    notices.push({
      message:
        action === "save"
          ? "Open this instance to save it. Its type is missing."
          : "This instance has not been stored yet. Cancel removes the draft.",
      blocksSave: action === "save",
    });
  } else if (draft.isNew && action === "cancel") {
    notices.push({
      message: "This instance has not been stored yet. Cancel removes the draft.",
      blocksSave: false,
    });
  }
  if (draft.rawJson === undefined && draft.baseline) {
    changeSummary(draft)
      .filter((change) => change.detail?.endsWith("→ Empty"))
      .forEach((change) => {
        notices.push({ message: `${change.label} will be cleared.`, blocksSave: false });
      });
  }
  return notices;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function UnsavedActionDialog({
  show,
  action,
  scope,
  drafts,
  offeredIds,
  includedIds,
  saveErrors = {},
  typeColorFor,
  linkFieldLabel,
  onToggle,
  onDismiss,
  onConfirm,
}: UnsavedActionDialogProps) {
  const offeredDrafts = drafts.filter((draft) => offeredIds.includes(draft.instanceId));
  const offeredIdSet = new Set(offeredIds);
  const related =
    action === "save"
      ? linkedUnsavedDrafts(offeredDrafts, drafts, linkFieldLabel).filter(
          (item) => !offeredIdSet.has(item.draft.instanceId),
        )
      : [];
  const includedRelated = related.filter((item) => includedIds.includes(item.draft.instanceId));
  const leftOutRelated = related.filter((item) => !includedIds.includes(item.draft.instanceId));
  const includedDrafts = [
    ...offeredDrafts.filter((draft) => includedIds.includes(draft.instanceId)),
    ...includedRelated.map((item) => item.draft),
  ];
  const choosing = offeredIds.length > 1;
  const notices = includedDrafts.flatMap((draft) =>
    draftNotices(draft, action, saveErrors[draft.instanceId]).map((notice) => ({
      ...notice,
      instanceId: draft.instanceId,
      instanceName: draft.instanceName,
    })),
  );
  const blocking = notices.filter((notice) => notice.blocksSave);
  const changeCount = includedDrafts.reduce((total, draft) => total + changeSummary(draft).length, 0);
  const createdCount =
    action === "save"
      ? includedDrafts.filter(
          (draft) =>
            draft.isNew &&
            !draftNotices(draft, "save", saveErrors[draft.instanceId]).some((notice) => notice.blocksSave),
        ).length
      : 0;
  const instanceSummary =
    choosing && includedDrafts.length !== offeredDrafts.length
      ? `${includedDrafts.length} of ${offeredDrafts.length} instances`
      : countLabel(includedDrafts.length, "instance", "instances");
  const confirmScope = choosing ? chosenScope(includedDrafts.length, drafts.length) : scope;
  const title = TITLES[action][confirmScope];
  const confirmLabel = CONFIRM_LABELS[action][confirmScope];

  const renderDraftCard = (
    draft: UnsavedInstanceDraft,
    withCheckbox: boolean,
    relation?: string,
    extraNotices: DraftNotice[] = [],
  ) => {
    const included = includedIds.includes(draft.instanceId);
    const changes = changeSummary(draft);
    const cardNotices = [
      ...(included ? draftNotices(draft, action, saveErrors[draft.instanceId]) : []),
      ...extraNotices,
    ];
    const typeColor = typeColorFor?.(draft) || typeColors[draft.type] || "#6c757d";
    return (
      <li key={draft.instanceId} className="unsaved-action-row">
        {withCheckbox && (
          <Form.Check
            type="checkbox"
            className="unsaved-action-include"
            aria-label={`Include ${draft.instanceName} (${draft.type})`}
            checked={included}
            onChange={() => onToggle(draft.instanceId)}
          />
        )}
        <div className={`unsaved-action-card${included ? "" : " unsaved-action-card--out"}`}>
          <div className="unsaved-action-identity">
            <div className="unsaved-action-type">
              <FontAwesomeIcon
                icon={faCircle}
                className="unsaved-action-type-dot"
                style={{ "--unsaved-type-color": typeColor } as React.CSSProperties}
                aria-hidden="true"
              />
              <span>{draft.type}</span>
            </div>
            <div className="unsaved-action-name">{draft.instanceName}</div>
            <div className="unsaved-action-id" title={draft.instanceId}>
              {draft.instanceId}
              {draft.space ? ` · ${draft.space}` : ""}
            </div>
            {relation && <div className="unsaved-action-link-from">{relation}</div>}
            <div className="unsaved-action-count">
              {countLabel(changes.length, "change", "changes")}
            </div>
            {!included && <div className="unsaved-action-skipped">Not included</div>}
          </div>
          {changes.length > 0 && (
            <ul className="unsaved-action-changes">
              {changes.map((change) => {
                const clears = change.detail?.endsWith("→ Empty") || change.detail === "Empty";
                return (
                  <li key={`${draft.instanceId}-${change.label}`}>
                    <span className="unsaved-action-change-label">{change.label}</span>
                    {change.detail && (
                      <span
                        className={`unsaved-action-change-detail${clears ? " unsaved-action-change-detail--warning" : ""}`}
                      >
                        {change.detail}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {cardNotices.length > 0 && (
            <ul className="unsaved-action-issues unsaved-action-card-issues">
              {cardNotices.map((notice) => (
                <li key={notice.message}>
                  <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                  <span>{notice.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </li>
    );
  };

  return (
    <Modal
      show={show}
      onHide={onDismiss}
      centered
      animation={false}
      dialogClassName="unsaved-action-dialog"
      aria-labelledby="unsaved-action-title"
      aria-describedby="unsaved-action-description"
    >
      <Modal.Header closeButton>
        <Modal.Title id="unsaved-action-title">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body id="unsaved-action-description">
        <p className="unsaved-action-summary">
          <span>{instanceSummary}</span>
          <span aria-hidden="true"> · </span>
          <span>{countLabel(changeCount, "change", "changes")}</span>
        </p>
        <p className="unsaved-action-intro">
          {action === "save" ? "These changes will be saved." : "The instances are not deleted."}
        </p>
        {(action === "cancel" || createdCount > 0 || notices.length > 0 || leftOutRelated.length > 0) && (
          <ul className="unsaved-action-issues">
            {action === "cancel" && (
              <li>
                <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                <span>These changes will be dropped.</span>
              </li>
            )}
            {createdCount > 0 && (
              <li>
                <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                <span>{countLabel(createdCount, "instance", "instances")} will be created.</span>
              </li>
            )}
            {leftOutRelated.length > 0 && (
              <li>
                <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                <span>{linkedLeftOutMessage(leftOutRelated)}</span>
              </li>
            )}
            {notices.map((notice) => (
              <li key={`${notice.instanceId}-${notice.message}`}>
                <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
                <span>
                  {includedDrafts.length > 1 ? `${notice.instanceName}: ` : ""}
                  {notice.message}
                </span>
              </li>
            ))}
          </ul>
        )}
        {choosing && includedDrafts.length === 0 && (
          <p className="unsaved-action-empty" role="status">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
            Choose at least one instance.
          </p>
        )}
        <div className="unsaved-action-scroll">
          <ul className="unsaved-action-cards">
            {offeredDrafts.map((draft) => renderDraftCard(draft, choosing))}
          </ul>
          {related.length > 0 && (
            <section className="unsaved-action-linked" aria-label="Linked drafts">
              <div className="unsaved-action-linked-head">
                <h3 className="unsaved-action-kicker">Linked drafts</h3>
                {leftOutRelated.length > 0 && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    className="unsaved-action-include-linked"
                    onClick={() => leftOutRelated.forEach((item) => onToggle(item.draft.instanceId))}
                  >
                    Include linked drafts
                  </Button>
                )}
              </div>
              <p className="unsaved-action-note">
                {includedRelated.length > 0
                  ? "Included linked drafts are saved first, so the links point at stored instances."
                  : "Include a linked draft to save it with this instance. New instances are created first."}
              </p>
              <ul className="unsaved-action-cards">
                {related.map((item) => {
                  const included = includedIds.includes(item.draft.instanceId);
                  const relation = item.fieldLabel
                    ? `Linked from ${item.fieldLabel} on ${item.fromName}`
                    : `Linked from ${item.fromName}`;
                  const warning = included
                    ? undefined
                    : item.draft.isNew
                      ? "Has not been stored yet. This link points at a draft."
                      : "Unsaved changes on this instance will not be saved.";
                  return renderDraftCard(
                    item.draft,
                    true,
                    relation,
                    warning ? [{ message: warning, blocksSave: false }] : [],
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onDismiss}>
          Keep editing
        </Button>
        <span
          title={
            includedDrafts.length === 0
              ? "Choose at least one instance"
              : blocking.length > 0
                ? blocking[0].message
                : undefined
          }
        >
          <Button
            variant="dark"
            className="unsaved-instances-panel-confirm"
            onClick={onConfirm}
            disabled={includedDrafts.length === 0 || blocking.length > 0}
          >
            <FontAwesomeIcon icon={action === "save" ? faFloppyDisk : faXmark} aria-hidden="true" />
            {confirmLabel}
          </Button>
        </span>
      </Modal.Footer>
    </Modal>
  );
}
