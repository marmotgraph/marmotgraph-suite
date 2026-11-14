import React, { useRef, useState } from "react";
import { Badge, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { fieldValueText } from "./fieldValueText";
import "./MultipleTextField.css";

function asTexts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(fieldValueText);
  }
  const text = fieldValueText(value);
  return text === "" ? [] : [text];
}

/**
 * The texts of a field with multiple values - shown as tags. New ones are added with the input, when pressing enter or
 * when leaving it (so a typed text isn't lost when saving). A text which is already part of the list isn't added again.
 */
export default function MultipleTextField({
  label,
  value,
  onChange,
  isEditMode,
}: Readonly<{
  label: string;
  value: unknown;
  onChange: (value: string[]) => void;
  isEditMode: boolean;
}>) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const texts = asTexts(value);

  if (!isEditMode) {
    return (
      <div className="view-value multiple-text-field">
        {texts.length === 0 ? (
          <em className="text-muted">No value</em>
        ) : (
          texts.map((t, index) => (
            <Badge key={index} bg="light" text="dark" className="view-badge multiple-text-value">
              {t}
            </Badge>
          ))
        )}
      </div>
    );
  }

  const add = () => {
    const added = text.trim();
    setText("");
    if (added && !texts.includes(added)) {
      onChange([...texts, added]);
    }
  };

  const remove = (index: number) => {
    onChange(texts.filter((_, i) => i !== index));
    // The button is gone with its tag - keep the focus in the field
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  };

  return (
    <div className="tag-container multiple-text-field">
      {texts.map((t, index) => (
        <Badge key={index} bg="light" text="dark" className="tag-badge multiple-text-value">
          {t}
          <button
            type="button"
            className="tag-remove-btn"
            aria-label={`Remove ${t}`}
            title="Remove"
            onClick={() => remove(index)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </Badge>
      ))}
      <Form.Control
        ref={inputRef}
        className="multiple-text-input"
        aria-label={`Add a value to ${label}`}
        placeholder="Add a value and press Enter"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={add}
      />
    </div>
  );
}
