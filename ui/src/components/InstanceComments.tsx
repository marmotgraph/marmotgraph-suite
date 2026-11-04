import React, { useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
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
export function CommentsToggle({
  subject,
  count,
  expanded,
  disabled = false,
  className,
  onClick,
}: {
  subject: string;
  count: number;
  expanded: boolean;
  disabled?: boolean;
  className: string;
  onClick: () => void;
}) {
  const label = `Comments on ${subject}${count > 0 ? ` (${count})` : ""}`;
  return (
    <Button
      type="button"
      variant="link"
      className={`edit-icon-btn comments-toggle ${className}${expanded ? " edit-icon-btn--active" : ""}`}
      aria-label={label}
      aria-expanded={expanded}
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
  onClose,
}: {
  comments: Comments;
  /** The properties shown as fields - their comments are listed with the field */
  fieldProperties: Set<string>;
  canModerate: boolean;
  onClose: () => void;
}) {
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
          <CommentThread comments={comments} canModerate={canModerate} subject="this instance" onClose={onClose} />
          {otherProperties.map((property) => (
            <div key={property} className="instance-comments-other" title={property}>
              <div className="view-label">{propertyName(property)}</div>
              <CommentThread
                comments={comments}
                property={property}
                canModerate={canModerate}
                subject={propertyName(property)}
                onClose={onClose}
              />
            </div>
          ))}
        </>
      )}
    </>
  );
}

/**
 * The comments on the given property (on the instance as a whole if there is none) - and the means to add one. It is
 * opened to comment if there are none yet - so canceling closes it again.
 */
export function CommentThread({
  comments,
  property,
  canModerate,
  subject,
  onClose,
}: {
  comments: Comments;
  property?: string;
  canModerate: boolean;
  /** What the comments are about - names the controls */
  subject: string;
  onClose: () => void;
}) {
  const thread = comments.comments.filter((comment) => comment.property === property);
  const [isAdding, setIsAdding] = useState(thread.length === 0);
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
              onClose();
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

/** The comments on a field - set apart from its value. */
export function FieldCommentThread({
  comments,
  property,
  canModerate,
  subject,
  onClose,
}: {
  comments: Comments;
  property: string;
  canModerate: boolean;
  subject: string;
  onClose: () => void;
}) {
  return (
    <div className="instance-field-panel" role="group" aria-label={`Comments on ${subject}`}>
      <p className="instance-field-panel-title">Comments</p>
      <CommentThread
        comments={comments}
        property={property}
        canModerate={canModerate}
        subject={subject}
        onClose={onClose}
      />
    </div>
  );
}

function CommentItem({
  comment,
  comments,
  canModerate,
}: {
  comment: InstanceComment;
  comments: Comments;
  canModerate: boolean;
}) {
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
}: {
  label: string;
  initialText?: string;
  submitLabel: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
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
}: {
  comment: InstanceComment;
  author: string;
  onHide: () => void;
  onDelete: () => Promise<void>;
}) {
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
