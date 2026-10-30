import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy, faLink, faTrash, faUser } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  createInvitationLink,
  fetchInvitations,
  InstanceInvitations,
  InvitationCandidate,
  InvitationLink,
  invitationUrl,
  inviteUser,
  MAX_INVITATION_LABEL_LENGTH,
  MIN_CANDIDATE_SEARCH_LENGTH,
  revokeInvitationLink,
  revokeUserInvitation,
  searchInvitationCandidates,
} from "../services/invitations";
import { Timestamp } from "./Timestamp";
import "./InstanceReview.css";

/** Delay after the last keystroke before the users are searched */
const SEARCH_DELAY_MS = 300;

/** Whom to invite - a known user or whoever gets an invitation link (labeled with the text typed) */
type Invitee = { kind: "user"; candidate: InvitationCandidate } | { kind: "link" };

/** An invitation to be removed - of an invited user (by its username) or an invitation link. */
type Removal =
  | { kind: "user"; username: string }
  | { kind: "link"; invitation: InvitationLink };

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Manages who is invited to review an instance: known users are searched and invited directly, everybody else gets an
 * invitation link. Both can be restricted to the scopes of the type of the instance. The invited users and the
 * invitation links which haven't been redeemed yet are listed - and can be removed.
 */
export default function InstanceReview({ instanceId }: { instanceId: string }) {
  const { getAccessToken } = useAuth();
  const [invitations, setInvitations] = useState<InstanceInvitations>();
  const [loadError, setLoadError] = useState<string>();
  /** Incremented to load the invitations again (after a change or a failure) */
  const [reloadCount, setReloadCount] = useState(0);
  const [removal, setRemoval] = useState<Removal>();

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchInvitations(token, instanceId))
      .then((loaded) => {
        if (!cancelled) {
          setInvitations(loaded);
          setLoadError(undefined);
        }
      })
      .catch((e: unknown) => {
        console.error("Failed to load the invitations", e);
        if (!cancelled) {
          setLoadError(errorMessage(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instanceId, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  if (loadError && !invitations) {
    return (
      <Alert variant="danger">
        {loadError}
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => {
              setLoadError(undefined);
              reload();
            }}
          >
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (!invitations) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" role="status" className="me-2" />
        Loading invitations...
      </div>
    );
  }

  const remove = async () => {
    if (!removal) {
      return;
    }
    const token = await getAccessToken();
    if (removal.kind === "user") {
      await revokeUserInvitation(token, instanceId, removal.username);
    } else {
      await revokeInvitationLink(token, instanceId, removal.invitation.id);
    }
    setRemoval(undefined);
    reload();
  };

  return (
    <div className="instance-view instance-review">
      <InviteForm
        instanceId={instanceId}
        scopes={invitations.scopes}
        onInvited={reload}
      />
      <InvitedUsers
        usernames={invitations.invitedUsers}
        onRemove={(username) => setRemoval({ kind: "user", username })}
      />
      <PendingInvitations
        invitations={invitations.pendingInvitations}
        onRemove={(invitation) => setRemoval({ kind: "link", invitation })}
      />
      <RemoveInvitationModal
        removal={removal}
        onCancel={() => setRemoval(undefined)}
        onRemove={remove}
      />
    </div>
  );
}

function InviteForm({
  instanceId,
  scopes,
  onInvited,
}: {
  instanceId: string;
  scopes?: string[];
  onInvited: () => void;
}) {
  const { getAccessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<Invitee>();
  const [selectedScopes, setSelectedScopes] = useState<string[]>(scopes ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  /** The user invited last - confirmed below the form */
  const [invitedUser, setInvitedUser] = useState<InvitationCandidate>();
  /** The link created last - its token can't be retrieved again */
  const [createdLink, setCreatedLink] = useState<InvitationLink>();

  // The scopes are only known once loaded - all of them are selected by default
  const scopeKey = (scopes ?? []).join("\n");
  useEffect(() => setSelectedScopes(scopes ?? []), [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The text typed is the label of an invitation link */
  const label = search.trim();
  const hasScopes = (scopes?.length ?? 0) > 0;
  const missingScopes = hasScopes && selectedScopes.length === 0;
  const canSubmit =
    !submitting &&
    !missingScopes &&
    (selection?.kind === "user" || (selection?.kind === "link" && label.length > 0));

  const changeSearch = (value: string) => {
    setSearch(value);
    setError(undefined);
    // A selected user doesn't match the new text anymore - choosing to create a link still holds (with the new label)
    if (selection?.kind === "user" || !value.trim()) {
      setSelection(undefined);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !selection) {
      return;
    }
    // Without the scopes being known, the core applies all scopes of the type
    const requestedScopes = hasScopes ? selectedScopes : [];
    setSubmitting(true);
    setError(undefined);
    setInvitedUser(undefined);
    setCreatedLink(undefined);
    getAccessToken()
      .then(async (token) => {
        if (selection.kind === "user") {
          await inviteUser(token, instanceId, selection.candidate.id, requestedScopes);
          setInvitedUser(selection.candidate);
        } else {
          setCreatedLink(await createInvitationLink(token, instanceId, label, requestedScopes));
        }
        setSearch("");
        setSelection(undefined);
        onInvited();
      })
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setSubmitting(false));
  };

  return (
    <section className="instance-review-section" aria-labelledby="instance-review-invite">
      <h3 id="instance-review-invite" className="view-label">
        Invite for review
      </h3>
      <Form onSubmit={submit} className="instance-review-form">
        <InviteeSearch
          instanceId={instanceId}
          search={search}
          onSearchChange={changeSearch}
          selection={selection}
          onSelect={setSelection}
        />

        <ScopeSelection
          scopes={scopes}
          selected={selectedScopes}
          onChange={setSelectedScopes}
        />

        {error && (
          <Alert variant="danger" className="mb-0">
            {error}
          </Alert>
        )}

        <div className="instance-review-actions">
          <Button type="submit" variant="outline-dark" disabled={!canSubmit}>
            {submitting && <Spinner animation="border" size="sm" className="me-2" />}
            {selection?.kind === "link" ? "Create invitation link" : "Invite user"}
          </Button>
        </div>
      </Form>

      {invitedUser && (
        <div className="instance-review-success" role="status">
          <FontAwesomeIcon icon={faCheck} aria-hidden="true" className="me-2" />
          {invitedUser.name} is invited for review.
        </div>
      )}
      {createdLink?.token && <CreatedLink invitation={createdLink} />}
    </section>
  );
}

/**
 * One field for both ways to invite: the known users matching the text are searched while typing - and an invitation
 * link labeled with the text is offered below them (for whoever isn't found). One of the options is selected.
 */
function InviteeSearch({
  instanceId,
  search,
  onSearchChange,
  selection,
  onSelect,
}: {
  instanceId: string;
  search: string;
  onSearchChange: (search: string) => void;
  selection?: Invitee;
  onSelect: (selection: Invitee | undefined) => void;
}) {
  const { getAccessToken } = useAuth();
  const [candidates, setCandidates] = useState<InvitationCandidate[]>();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const term = search.trim();
  const tooLongForLabel = term.length > MAX_INVITATION_LABEL_LENGTH;

  useEffect(() => {
    if (term.length < MIN_CANDIDATE_SEARCH_LENGTH) {
      setCandidates(undefined);
      setError(undefined);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      getAccessToken()
        .then((token) => searchInvitationCandidates(token, instanceId, term))
        .then((found) => {
          if (!cancelled) {
            setCandidates(found);
            setError(undefined);
          }
        })
        .catch((e: unknown) => !cancelled && setError(errorMessage(e)))
        .finally(() => !cancelled && setSearching(false));
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [getAccessToken, instanceId, term]);

  const linkSelected = selection?.kind === "link";

  return (
    <Form.Group controlId="instance-review-search">
      <Form.Label>User or invitation label</Form.Label>
      <Form.Control
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Email address, username or name"
        autoComplete="off"
        aria-describedby="instance-review-search-help"
      />
      <Form.Text id="instance-review-search-help" className="instance-review-help">
        Finds users who have signed in before. For anybody else, create an invitation link - the text becomes its
        label, so you recognize it in the list below.
      </Form.Text>
      {term.length > 0 && (
        <div className="instance-review-candidates" aria-live="polite">
          <ul className="instance-review-list" aria-label="Invite">
            {term.length < MIN_CANDIDATE_SEARCH_LENGTH ? (
              <li className="instance-review-hint">
                Type at least {MIN_CANDIDATE_SEARCH_LENGTH} characters to search users.
              </li>
            ) : searching && !candidates ? (
              <li className="instance-review-hint">
                <Spinner animation="border" size="sm" role="status" className="me-2" />
                Searching users...
              </li>
            ) : error ? (
              <li className="instance-review-hint instance-review-hint--error">{error}</li>
            ) : candidates && candidates.length === 0 ? (
              <li className="instance-review-hint">No users found.</li>
            ) : (
              candidates?.map((candidate) => {
                const isSelected = selection?.kind === "user" && selection.candidate.id === candidate.id;
                return (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      className={`instance-review-candidate${isSelected ? " instance-review-candidate--selected" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => onSelect(isSelected ? undefined : { kind: "user", candidate })}
                    >
                      <FontAwesomeIcon icon={faUser} className="instance-review-user-icon" aria-hidden="true" />
                      <span className="instance-review-name">{candidate.name}</span>
                      {candidate.name !== candidate.username && (
                        <span className="instance-review-username">{candidate.username}</span>
                      )}
                      {isSelected && (
                        <FontAwesomeIcon icon={faCheck} className="instance-review-check" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
            <li className="instance-review-list-link">
              <button
                type="button"
                className={`instance-review-candidate${linkSelected ? " instance-review-candidate--selected" : ""}`}
                aria-pressed={linkSelected}
                disabled={tooLongForLabel}
                onClick={() => onSelect(linkSelected ? undefined : { kind: "link" })}
              >
                <FontAwesomeIcon icon={faLink} className="instance-review-user-icon" aria-hidden="true" />
                <span className="instance-review-name">
                  Create an invitation link labeled <strong>{term}</strong>
                </span>
                {linkSelected && (
                  <FontAwesomeIcon icon={faCheck} className="instance-review-check" aria-hidden="true" />
                )}
              </button>
              {tooLongForLabel && (
                <div className="instance-review-invalid px-3 pb-2">
                  A label can have at most {MAX_INVITATION_LABEL_LENGTH} characters.
                </div>
              )}
            </li>
          </ul>
        </div>
      )}
    </Form.Group>
  );
}

/** The scopes of the type the invitation applies to - in addition to the instance itself. */
function ScopeSelection({
  scopes,
  selected,
  onChange,
}: {
  scopes?: string[];
  selected: string[];
  onChange: (scopes: string[]) => void;
}) {
  if (!scopes) {
    return (
      <p className="instance-review-help mb-0">
        The scopes of this type can't be listed with your permissions - the invitation applies to all of them.
      </p>
    );
  }
  if (scopes.length === 0) {
    return (
      <p className="instance-review-help mb-0">
        The type defines no scopes - the invitation applies to this instance only.
      </p>
    );
  }
  const toggle = (scope: string, checked: boolean) =>
    onChange(checked ? scopes.filter((s) => s === scope || selected.includes(s)) : selected.filter((s) => s !== scope));

  return (
    <fieldset className="instance-review-scopes">
      <legend className="instance-review-legend">
        Scopes
        <span className="instance-review-count">
          {selected.length} / {scopes.length}
        </span>
      </legend>
      <p className="instance-review-help">
        The invitation covers this instance and the instances reached by the selected scopes.
      </p>
      {scopes.map((scope) => (
        <Form.Check
          key={scope}
          type="checkbox"
          id={`instance-review-scope-${scope}`}
          label={scope}
          checked={selected.includes(scope)}
          onChange={(e) => toggle(scope, e.target.checked)}
        />
      ))}
      {selected.length === 0 && (
        <div className="instance-review-invalid" role="alert">
          Select at least one scope.
        </div>
      )}
    </fieldset>
  );
}

/** The link of a newly created invitation - to be copied, since it can't be shown again. */
function CreatedLink({ invitation }: { invitation: InvitationLink }) {
  const [copied, setCopied] = useState(false);
  const url = invitationUrl(invitation.token!);

  const copy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch((e: unknown) => console.error("Failed to copy the invitation link", e));
  };

  return (
    <div className="instance-review-created" role="status">
      <div className="instance-review-created-title">
        <FontAwesomeIcon icon={faCheck} aria-hidden="true" className="me-2" />
        Invitation link for {invitation.label} created
      </div>
      <div className="instance-review-created-link">
        <Form.Control
          readOnly
          value={url}
          aria-label="Invitation link"
          onFocus={(e) => e.target.select()}
        />
        <Button variant="outline-dark" onClick={copy} title={copied ? "Copied" : "Copy link"}>
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="me-2" aria-hidden="true" />
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p className="instance-review-help mb-0">
        Copy the link now - it is shown only once. It works for one person
        {invitation.expiresAt && (
          <>
            {" "}until <Timestamp value={invitation.expiresAt} fallback={null} />
          </>
        )}
        .
      </p>
    </div>
  );
}

function ScopeTags({ scopes }: { scopes: string[] }) {
  return (
    <span className="instance-review-scope-tags">
      {scopes.length === 0 ? (
        <span className="instance-review-meta">This instance only</span>
      ) : (
        scopes.map((scope) => (
          <span key={scope} className="instance-review-scope-tag">
            {scope}
          </span>
        ))
      )}
    </span>
  );
}

function InvitedUsers({
  usernames,
  onRemove,
}: {
  usernames?: string[];
  onRemove: (username: string) => void;
}) {
  return (
    <section className="instance-review-section" aria-labelledby="instance-review-users">
      <h3 id="instance-review-users" className="view-label">
        Invited users
        {usernames && <span className="instance-review-count">{usernames.length}</span>}
      </h3>
      {!usernames ? (
        <p className="instance-review-empty">
          You aren't allowed to list the invited users.
        </p>
      ) : usernames.length === 0 ? (
        <p className="instance-review-empty">No users invited yet.</p>
      ) : (
        <ul className="instance-review-list">
          {usernames.map((username) => (
            <li key={username} className="instance-review-row">
              <FontAwesomeIcon icon={faUser} className="instance-review-user-icon" aria-hidden="true" />
              <span className="instance-review-name">{username}</span>
              <Button
                variant="link"
                className="edit-icon-btn instance-review-remove"
                onClick={() => onRemove(username)}
                aria-label={`Remove the invitation of ${username}`}
                title="Remove invitation"
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PendingInvitations({
  invitations,
  onRemove,
}: {
  invitations: InvitationLink[];
  onRemove: (invitation: InvitationLink) => void;
}) {
  return (
    <section className="instance-review-section" aria-labelledby="instance-review-pending">
      <h3 id="instance-review-pending" className="view-label">
        Pending invitation links
        <span className="instance-review-count">{invitations.length}</span>
      </h3>
      {invitations.length === 0 ? (
        <p className="instance-review-empty">No pending invitation links.</p>
      ) : (
        <ul className="instance-review-list">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="instance-review-row instance-review-row--link">
              <div className="instance-review-row-main">
                <span className="instance-review-name">{invitation.label || "Unlabeled"}</span>
                <span className="instance-review-meta">
                  Created <Timestamp value={invitation.createdAt} fallback="at an unknown time" />
                  {invitation.expiresAt && (
                    <>
                      {" · "}expires <Timestamp value={invitation.expiresAt} fallback={null} />
                    </>
                  )}
                </span>
                <ScopeTags scopes={invitation.scopes} />
              </div>
              <Button
                variant="link"
                className="edit-icon-btn instance-review-remove"
                onClick={() => onRemove(invitation)}
                aria-label={`Remove the invitation link ${invitation.label ?? ""}`.trim()}
                title="Remove invitation link"
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RemoveInvitationModal({
  removal,
  onCancel,
  onRemove,
}: {
  removal?: Removal;
  onCancel: () => void;
  onRemove: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string>();
  const show = Boolean(removal);

  useEffect(() => {
    if (show) {
      setError(undefined);
      setRemoving(false);
    }
  }, [show]);

  const submit = () => {
    setRemoving(true);
    setError(undefined);
    onRemove().catch((e: unknown) => {
      setError(errorMessage(e));
      setRemoving(false);
    });
  };

  return (
    <Modal
      show={show}
      onHide={() => !removing && onCancel()}
      centered
      animation={false}
      keyboard={!removing}
      backdrop={removing ? "static" : true}
      aria-labelledby="remove-invitation-title"
    >
      <Modal.Header closeButton>
        <Modal.Title id="remove-invitation-title">Remove invitation?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {removal?.kind === "user" ? (
          <p className="mb-0">
            <strong>{removal.username}</strong> will no longer be able to review this instance.
          </p>
        ) : (
          removal && (
            <p className="mb-0">
              The invitation link <strong>{removal.invitation.label || "Unlabeled"}</strong> will stop working.
            </p>
          )
        )}
        {error && (
          <Alert variant="danger" className="mt-3 mb-0">
            {error}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={removing}>
          Cancel
        </Button>
        <Button variant="danger" onClick={submit} disabled={removing}>
          {removing && <Spinner animation="border" size="sm" className="me-2" />}
          Remove invitation
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
