    import React, { useId, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { Pencil } from "lucide-react";

/**
 * A text which can be edited in place - clicking it (or its pencil) turns it into a field. Enter (Ctrl+Enter if it has
 * several lines) or leaving the field saves the change, Escape discards it.
 */
export default function InlineEdit({
  as: Tag,
  className,
  value,
  display,
  placeholder,
  label,
  multiline,
  editable,
  onSave,
}: {
  /** The element the text is shown in (e.g. the heading of the title) */
  as: "h2" | "p";
  className: string;
  /** The value which is edited */
  value: string;
  /** What is shown while the text is not edited - the value if not given */
  display?: string;
  /** What is shown if there is no text */
  placeholder: string;
  /** What is edited - for the accessible names */
  label: string;
  multiline?: boolean;
  editable: boolean;
  /** Saves the new value - resolves to false if it failed (the field then stays open) */
  onSave: (value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string>();
  const [saving, setSaving] = useState(false);
  const help = useId();
  // If the field is open and not saved yet - closing it may blur it, which must not save (again)
  const open = useRef(false);
  const shown = display ?? value;

  if (!editable) {
    return shown ? <Tag className={className}>{shown}</Tag> : null;
  }

  const start = () => {
    open.current = true;
    setDraft(value);
  };

  const close = () => {
    open.current = false;
    setDraft(undefined);
  };

  const save = async () => {
    if (draft === undefined || !open.current) {
      return;
    }
    if (draft.trim() === value.trim()) {
      close();
      return;
    }
    open.current = false;
    setSaving(true);
    const saved = await onSave(draft.trim());
    setSaving(false);
    if (saved) {
      setDraft(undefined);
    } else {
      open.current = true;
    }
  };

  if (draft !== undefined) {
    return (
      <div className="modeler-inline">
        <Form.Control
          {...(multiline && { as: "textarea" as const, rows: 3 })}
          className={`modeler-inline-input ${className}`}
          aria-label={label}
          aria-describedby={help}
          placeholder={placeholder}
          autoFocus
          readOnly={saving}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            } else if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void save();
            }
          }}
        />
        <div id={help} className="modeler-inline-help">
          {saving ? "Saving..." : `${multiline ? "Ctrl+Enter" : "Enter"} to save, Esc to cancel`}
        </div>
      </div>
    );
  }

  return (
    <div className="modeler-inline modeler-inline--editable">
      <Tag className={`${className} modeler-inline-text`} onClick={start}>
        {shown || <span className="modeler-inline-placeholder">{placeholder}</span>}
      </Tag>
      <Button
        size="sm"
        variant="link"
        className="edit-icon-btn flex-shrink-0"
        title={`Edit ${label}`}
        aria-label={`Edit ${label}`}
        onClick={start}
      >
        <Pencil size={16} />
      </Button>
    </div>
  );
}
