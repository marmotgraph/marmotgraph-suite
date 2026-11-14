import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Form, Modal, Overlay, Popover, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment, faPencil, faTrash } from "@fortawesome/free-solid-svg-icons";
import { faComment as faCommentRegular } from "@fortawesome/free-regular-svg-icons";
import { InstanceComments as Comments } from "../hooks/useInstanceComments";
import { InstanceComment } from "../services/comments";
import { Timestamp } from "./Timestamp";
import "./InstanceComments.css";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The name of the property - for properties which are no field of the type (any more) */
const propertyName = (property: string) => property.split(/[/#]/).pop() || property;

/** Shows or hides the comments on the given subject - it tells how many there are. */
function CommentsToggle({
  buttonRef,
  subject,
  count,
  expanded,
  disabled = false,
  className,
  onClick,
}: Readonly<{
  buttonRef?: React.Ref<HTMLButtonElement>;
  subject: string;
  count: number;
  expanded: boolean;
  disabled?: boolean;
  className: string;
  onClick: () => void;
}>) {
  const label = `Comments on ${subject}${count > 0 ? ` (${count})` : ""}`;
  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="link"
      className={`edit-icon-btn comments-toggle ${className}${expanded ? " edit-icon-btn--active" : ""}`}
      aria-label={label}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      title={disabled ? undefined : label}
      disabled={disabled}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={count > 0 ? faComment : faCommentRegular} />
      {count > 0 && <span className="comments-toggle-count">{count}</span>}
    </Button>
  );
}

/** The comments on the instance as a whole - and on the properties which aren't shown as fields (they'd get lost otherwise). */
export function InstanceCommentsOverview({
  comments,
  fieldProperties,
  canModerate,
}: Readonly<{
  comments: Comments;
  /** The properties shown as fields - their comments are listed with the field */
  fieldProperties: Set<string>;
  canModerate: boolean;
}>) {
  const onInstance = comments.comments.filter((comment) => !comment.property);
  const otherProperties = [
    ...new Set(
      comments.comments.flatMap((comment) =>
        comment.property && !fieldProperties.has(comment.property) ? [comment.property] : [],
      ),
    ),
  ];
  return (
    <>
      {comments.loadError ? (
        <Alert variant="danger" className="mb-0">
          {comments.loadError}
          <div className="mt-2">
            <Button size="sm" variant="outline-danger" onClick={comments.reload}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : (
        <>
          {comments.loading ? (
            <p className="instance-comments-empty">
              <Spinner animation="border" size="sm" role="status" className="me-2" />
              Loading comments...
            </p>
          ) : (
            onInstance.length === 0 && <p className="instance-comments-empty">No comments on this instance yet.</p>
          )}
          {/* Shown right away - writing a comment is up to the user (it would draw the focus to the end of the page) */}
          <CommentThread comments={comments} canModerate={canModerate} subject="this instance" startAdding={false} />
          {otherProperties.map((property) => (
            <div key={property} className="instance-comments-other" title={property}>
              <div className="view-label">{propertyName(property)}</div>
              <CommentThread
                comments={comments}
                property={property}
                canModerate={canModerate}
                subject={propertyName(property)}
              />
            </div>
          ))}
        </>
      )}
    </>
  );
}

/**
 * The comments on the given property (on the instance as a whole if there is none) - and the means to add one. Unless
 * told otherwise, it is opened to comment if there are none yet - so canceling closes it again.
 */
export function CommentThread({
  comments,
  property,
  canModerate,
  subject,
  startAdding = true,
  onClose,
}: Readonly<{
  comments: Comments;
  property?: string;
  canModerate: boolean;
  /** What the comments are about - names the controls */
  subject: string;
  startAdding?: boolean;
  onClose?: () => void;
}>) {
  const thread = comments.comments.filter((comment) => comment.property === property);
  const [isAdding, setIsAdding] = useState(startAdding && thread.length === 0);
  return (
    <div className="comment-thread">
      {thread.length > 0 && (
        <ul className="comment-list">
          {thread.map((comment) => (
            <CommentItem key={comment.id} comment={comment} comments={comments} canModerate={canModerate} />
          ))}
        </ul>
      )}
      {isAdding ? (
        <CommentForm
          label={`Comment on ${subject}`}
          submitLabel="Add comment"
          onSubmit={async (text) => {
            await comments.add(property, text);
            setIsAdding(false);
          }}
          onCancel={() => {
            setIsAdding(false);
            if (thread.length === 0) {
              onClose?.();
            }
          }}
        />
      ) : (
        <Button
          variant="link"
          size="sm"
          className="comment-add"
          aria-label={`Add comment on ${subject}`}
          onClick={() => setIsAdding(true)}
        >
          Add comment
        </Button>
      )}
    </div>
  );
}

/** The comments on a field - in a popup at their toggle, so they don't get in the way of the fields. */
export function FieldComments({
  comments,
  property,
  canModerate,
  subject,
}: Readonly<{
  comments: Comments;
  property: string;
  canModerate: boolean;
  subject: string;
}>) {
  const [show, setShow] = useState(false);
  const [popup, setPopup] = useState<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const count = comments.comments.filter((comment) => comment.property === property).length;

  // Keyboard users continue in the popup (which isn't next to the toggle in the document) - unless a comment is started
  useEffect(() => {
    if (popup && !popup.contains(document.activeElement)) {
      popup.focus({ preventScroll: true });
    }
  }, [popup]);

  const closeToToggle = () => {
    setShow(false);
    toggleRef.current?.focus();
  };

  /** Whether closing would lose the text of a comment - it stays open until that is canceled or stored */
  const isWriting = () =>
    [...(popup?.querySelectorAll("textarea") ?? [])].some((textarea) => textarea.value.trim() !== "");

  const handleOutside = (event: Event) => {
    // The confirmation to delete a comment is no part of the popup in the document
    const inDialog = event.target instanceof Element && event.target.closest(".modal, .modal-backdrop");
    if (inDialog || isWriting()) {
      return;
    }
    if (event.type === "click") {
      setShow(false);
    } else {
      closeToToggle();
    }
  };

  return (
    <>
      <CommentsToggle
        buttonRef={toggleRef}
        className="instance-field-comments-toggle"
        subject={subject}
        count={count}
        expanded={show}
        onClick={() => {
          if (!show) {
            setShow(true);
          } else if (!isWriting()) {
            setShow(false);
          }
        }}
      />
      <Overlay
        ref={setPopup}
        show={show}
        target={toggleRef}
        placement="bottom-end"
        flip
        transition={false}
        rootClose
        onHide={handleOutside}
      >
        <Popover className="field-comments-popover" role="dialog" aria-label={`Comments on ${subject}`} tabIndex={-1}>
          <Popover.Body>
            <p className="field-comments-popover-title">Comments on {subject}</p>
            <CommentThread
              comments={comments}
              property={property}
              canModerate={canModerate}
              subject={subject}
              onClose={closeToToggle}
            />
          </Popover.Body>
        </Popover>
      </Overlay>
    </>
  );
}

function CommentItem({
  comment,
  comments,
  canModerate,
}: Readonly<{
  comment: InstanceComment;
  comments: Comments;
  canModerate: boolean;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const author = comment.own ? "You" : (comment.createdBy?.name ?? "A reviewer");
  return (
    <li className="comment-item">
      <div className="comment-header">
        <span className="comment-author" title={comment.createdBy?.username}>
          {author}
        </span>
        <span className="comment-time">
          <Timestamp value={comment.createdAt} fallback={null} />
          {comment.updatedAt && (
            <span title={comment.updatedAt}> (edited)</span>
          )}
        </span>
        {!isEditing && (
          <span className="comment-actions">
            {comment.own && (
              <Button
                variant="link"
                className="edit-icon-btn"
                aria-label="Edit comment"
                title="Edit comment"
                onClick={() => setIsEditing(true)}
              >
                <FontAwesomeIcon icon={faPencil} />
              </Button>
            )}
            {(comment.own || canModerate) && (
              <Button
                variant="link"
                className="edit-icon-btn"
                aria-label="Delete comment"
                title="Delete comment"
                onClick={() => setConfirmDelete(true)}
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            )}
          </span>
        )}
      </div>
      {isEditing ? (
        <CommentForm
          label="Edit comment"
          initialText={comment.text}
          submitLabel="Save comment"
          onSubmit={async (text) => {
            await comments.update(comment.id, text);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <p className="comment-text">{comment.text}</p>
      )}
      {confirmDelete && (
        <DeleteCommentModal
          comment={comment}
          author={author}
          onHide={() => setConfirmDelete(false)}
          onDelete={() => comments.remove(comment.id)}
        />
      )}
    </li>
  );
}

/** Writes a comment - the text is kept if storing it fails. */
function CommentForm({
  label,
  initialText = "",
  submitLabel,
  onSubmit,
  onCancel,
}: Readonly<{
  label: string;
  initialText?: string;
  submitLabel: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
}>) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const trimmed = text.trim();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit(trimmed);
    } catch (e) {
      console.error("Failed to store the comment", e);
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Form className="comment-form" onSubmit={submit}>
      {error && (
        <Alert variant="danger" className="mb-2">
          {error}
        </Alert>
      )}
      <Form.Control
        as="textarea"
        rows={2}
        autoFocus
        aria-label={label}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="comment-form-actions">
        <Button type="button" size="sm" variant="outline-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          variant="outline-dark"
          disabled={!trimmed || trimmed === initialText || saving}
        >
          {saving && <Spinner animation="border" size="sm" className="me-2" />}
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
}

function DeleteCommentModal({
  comment,
  author,
  onHide,
  onDelete,
}: Readonly<{
  comment: InstanceComment;
  author: string;
  onHide: () => void;
  onDelete: () => Promise<void>;
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      // Removes the comment - and with it this dialog
      await onDelete();
    } catch (e) {
      console.error("Failed to delete the comment", e);
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal show onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Delete comment</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <p>Delete this comment{comment.own ? "" : ` by ${author}`}? This can't be undone.</p>
        <p className="comment-text mb-0">{comment.text}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={remove}>
          {busy ? <Spinner animation="border" size="sm" /> : "Delete comment"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
