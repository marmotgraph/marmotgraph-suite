import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronDown,
  faChevronRight,
  faCopy,
  faLink,
  faTrash,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  createInvitationLink,
  fetchInvitations,
  InstanceInvitations,
  InvitationCandidate,
  InvitationLink,
  invitationUrl,
  InvitedUser,
  inviteUser,
  MAX_INVITATION_LABEL_LENGTH,
  MIN_CANDIDATE_SEARCH_LENGTH,
  revokeInvitationLink,
  revokeUserInvitation,
  searchInvitationCandidates,
} from "../services/invitations";
import { fetchReleaseTree, ReleaseNode } from "../services/instances";
import { flattenReleaseTree, prepareReleaseTree } from "../modules/editor/releaseTree";
import { ReleaseNodeLabel, StatusTag } from "./InstanceRelease";
import { Timestamp } from "./Timestamp";
import "./InstanceRelease.css";
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
 * invitation link. Both apply to the instance and the selected scopes of its type (the instance only if none are
 * selected) - the instances covered follow the scopes selected, so it is clear what an invitation includes. The invited
 * users and the invitation links which haven't been redeemed yet are listed - and can be removed.
 */
export default function InstanceReview({
  instanceId,
  onInstanceClick,
}: {
  instanceId: string;
  /** Called when the name of an instance in scope is clicked */
  onInstanceClick?: (instanceId: string) => void;
}) {
  const { getAccessToken } = useAuth();
  const [invitations, setInvitations] = useState<InstanceInvitations>();
  const [loadError, setLoadError] = useState<string>();
  /** Incremented to load the invitations again (after a change or a failure) */
  const [reloadCount, setReloadCount] = useState(0);
  const [removal, setRemoval] = useState<Removal>();
  const scopeTrees = useScopeTrees(instanceId, invitations?.scopes ?? []);

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
        scopeTrees={scopeTrees}
        onInvited={reload}
        onInstanceClick={onInstanceClick}
      />
      <InvitedUsers
        users={invitations.invitedUsers}
        typeScopes={invitations.scopes}
        scopeTrees={scopeTrees}
        onInstanceClick={onInstanceClick}
        onRemove={(username) => setRemoval({ kind: "user", username })}
      />
      <PendingInvitations
        invitations={invitations.pendingInvitations}
        typeScopes={invitations.scopes}
        scopeTrees={scopeTrees}
        onInstanceClick={onInstanceClick}
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
  scopeTrees,
  onInvited,
  onInstanceClick,
}: {
  instanceId: string;
  scopes: string[];
  scopeTrees: ScopeTrees;
  onInvited: () => void;
  onInstanceClick?: (instanceId: string) => void;
}) {
  const { getAccessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(scopes);
  /** The invitation being created */
  const [submitting, setSubmitting] = useState<Invitee>();
  const [error, setError] = useState<string>();
  /** The user invited last - confirmed below the form */
  const [invitedUser, setInvitedUser] = useState<InvitationCandidate>();
  /** The link created last - its token can't be retrieved again */
  const [createdLink, setCreatedLink] = useState<InvitationLink>();

  // All scopes are selected by default - again when they change
  const scopeKey = scopes.join("\n");
  useEffect(() => setSelectedScopes(scopes), [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeSearch = (value: string) => {
    setSearch(value);
    setError(undefined);
  };

  const invite = (invitee: Invitee) => {
    /** The text typed is the label of an invitation link */
    const label = search.trim();
    if (submitting || (invitee.kind === "link" && !label)) {
      return;
    }
    // No scopes selected: the invitation applies to the instance only
    const requestedScopes = scopes.filter((scope) => selectedScopes.includes(scope));
    setSubmitting(invitee);
    setError(undefined);
    setInvitedUser(undefined);
    setCreatedLink(undefined);
    getAccessToken()
      .then(async (token) => {
        if (invitee.kind === "user") {
          await inviteUser(token, instanceId, invitee.candidate.id, requestedScopes);
          setInvitedUser(invitee.candidate);
        } else {
          setCreatedLink(await createInvitationLink(token, instanceId, label, requestedScopes));
        }
        setSearch("");
        onInvited();
      })
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setSubmitting(undefined));
  };

  return (
    <section className="instance-review-section" aria-labelledby="instance-review-invite">
      <h3 id="instance-review-invite" className="view-label">
        Invite for review
      </h3>
      <div className="instance-review-form">
        <ScopeSelection
          scopes={scopes}
          selected={selectedScopes}
          onChange={setSelectedScopes}
          trees={scopeTrees.trees}
        />

        {scopes.length > 0 && (
          <CoveredInstances
            scopes={scopes}
            selected={selectedScopes}
            scopeTrees={scopeTrees}
            onInstanceClick={onInstanceClick}
          />
        )}

        <InviteeSearch
          instanceId={instanceId}
          search={search}
          onSearchChange={changeSearch}
          submitting={submitting}
          onInvite={invite}
        />

        {error && (
          <Alert variant="danger" className="mb-0">
            {error}
          </Alert>
        )}
      </div>

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
 * One field for both ways to invite: the known users matching the text are searched while typing - each can be invited
 * right away - and an invitation link labeled with the text is offered below them (for whoever isn't found).
 */
function InviteeSearch({
  instanceId,
  search,
  onSearchChange,
  submitting,
  onInvite,
}: {
  instanceId: string;
  search: string;
  onSearchChange: (search: string) => void;
  /** The invitation being created - all others wait for it */
  submitting?: Invitee;
  onInvite: (invitee: Invitee) => void;
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

  const creatingLink = submitting?.kind === "link";

  return (
    <Form.Group controlId="instance-review-search">
      <Form.Label>User or invitation label</Form.Label>
      <Form.Text id="instance-review-search-help" className="instance-review-help instance-review-search-help">
        Finds users who have signed in before. For anybody else, create an invitation link.
      </Form.Text>
      <Form.Control
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Email address, username or name"
        autoComplete="off"
        aria-describedby="instance-review-search-help"
      />
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
                const inviting = submitting?.kind === "user" && submitting.candidate.id === candidate.id;
                return (
                  <li key={candidate.id} className="instance-review-row">
                    <FontAwesomeIcon icon={faUser} className="instance-review-user-icon" aria-hidden="true" />
                    <div className="instance-review-row-main">
                      <span className="instance-review-name">{candidate.name}</span>
                      {candidate.name !== candidate.username && (
                        <span className="instance-review-username">{candidate.username}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline-dark"
                      className="instance-review-invite"
                      disabled={Boolean(submitting)}
                      onClick={() => onInvite({ kind: "user", candidate })}
                      aria-label={`Invite ${candidate.name}`}
                    >
                      {inviting && <Spinner animation="border" size="sm" className="me-2" />}
                      Invite user
                    </Button>
                  </li>
                );
              })
            )}
            <li className="instance-review-row">
              <FontAwesomeIcon icon={faLink} className="instance-review-user-icon" aria-hidden="true" />
              <div className="instance-review-row-main">
                <span className="instance-review-name">Invite user &apos;{term}&apos;</span>
                {tooLongForLabel && (
                  <span className="instance-review-invalid">
                    A label can have at most {MAX_INVITATION_LABEL_LENGTH} characters.
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline-dark"
                className="instance-review-invite"
                disabled={tooLongForLabel || Boolean(submitting)}
                onClick={() => onInvite({ kind: "link" })}
                aria-label={`Create invitation link labeled ${term}`}
              >
                {creatingLink && <Spinner animation="border" size="sm" className="me-2" />}
                Create invitation link
              </Button>
            </li>
          </ul>
        </div>
      )}
    </Form.Group>
  );
}

/** The scopes of the type the invitation applies to - in addition to the instance itself (none: the instance only). */
function ScopeSelection({
  scopes,
  selected,
  onChange,
  trees,
}: {
  scopes: string[];
  selected: string[];
  onChange: (scopes: string[]) => void;
  /** The trees loaded so far - by scope - to tell how many instances each scope reaches */
  trees: Record<string, ReleaseNode>;
}) {
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
        The invitation covers this instance and the instances reached by the selected scopes - this instance only if
        none is selected.
      </p>
      {scopes.map((scope) => (
        <Form.Check
          key={scope}
          type="checkbox"
          id={`instance-review-scope-${scope}`}
          label={
            <>
              {scope}
              {trees[scope] && (
                <span className="instance-review-meta ms-2">
                  {pluralize(countReached(trees[scope]), "instance")}
                </span>
              )}
            </>
          }
          checked={selected.includes(scope)}
          onChange={(e) => toggle(scope, e.target.checked)}
        />
      ))}
      {selected.length === 0 && (
        <div className="instance-review-scope-note" role="status">
          No scope selected - the invitation covers this instance only.
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
  users,
  typeScopes,
  scopeTrees,
  onInstanceClick,
  onRemove,
}: {
  users?: InvitedUser[];
  /** The scopes of the type - to list the instances an invitation covers */
  typeScopes: string[];
  scopeTrees: ScopeTrees;
  onInstanceClick?: (instanceId: string) => void;
  onRemove: (username: string) => void;
}) {
  return (
    <section className="instance-review-section" aria-labelledby="instance-review-users">
      <h3 id="instance-review-users" className="view-label">
        Invited users
        {users && <span className="instance-review-count">{users.length}</span>}
      </h3>
      {!users ? (
        <p className="instance-review-empty">
          You aren't allowed to list the invited users.
        </p>
      ) : users.length === 0 ? (
        <p className="instance-review-empty">No users invited yet.</p>
      ) : (
        <ul className="instance-review-list">
          {users.map(({ username, scopes }) => (
            <li key={username} className="instance-review-row instance-review-row--top">
              <FontAwesomeIcon icon={faUser} className="instance-review-user-icon" aria-hidden="true" />
              <div className="instance-review-row-main">
                <span className="instance-review-name">{username}</span>
                <ScopeTags scopes={scopes} />
                <CoveredInstancesToggle
                  scopes={typeScopes}
                  selected={scopes}
                  scopeTrees={scopeTrees}
                  onInstanceClick={onInstanceClick}
                />
              </div>
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
  typeScopes,
  scopeTrees,
  onInstanceClick,
  onRemove,
}: {
  invitations: InvitationLink[];
  /** The scopes of the type - to list the instances an invitation covers */
  typeScopes: string[];
  scopeTrees: ScopeTrees;
  onInstanceClick?: (instanceId: string) => void;
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
            <li key={invitation.id} className="instance-review-row instance-review-row--top">
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
                <CoveredInstancesToggle
                  scopes={typeScopes}
                  selected={invitation.scopes}
                  scopeTrees={scopeTrees}
                  onInstanceClick={onInstanceClick}
                />
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

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The number of instances reached by the scope of a tree - without the instance itself */
function countReached(tree: ReleaseNode) {
  return flattenReleaseTree(tree, {}, false).length - 1;
}

/** Combines the trees of several scopes (of the same instance) into one - the children are merged by instance. */
function mergeTrees(trees: ReleaseNode[]): ReleaseNode {
  const childrenById = new Map<string, ReleaseNode[]>();
  trees.forEach((tree) =>
    tree.children.forEach((child) => {
      const merged = childrenById.get(child.instanceId);
      if (merged) {
        merged.push(child);
      } else {
        childrenById.set(child.instanceId, [child]);
      }
    }),
  );
  return { ...trees[0], children: [...childrenById.values()].map(mergeTrees) };
}

interface ScopeTrees {
  /** The trees loaded so far - by scope */
  trees: Record<string, ReleaseNode>;
  error?: string;
  retry: () => void;
}

/** Loads the release tree of the instance for every scope of its type - to be combined for the scopes selected. */
function useScopeTrees(instanceId: string, scopes: string[]): ScopeTrees {
  const { getAccessToken } = useAuth();
  const scopeKey = scopes.join("\n");
  /** The trees belong to the instance and scopes they were loaded for */
  const loadKey = `${instanceId}\n${scopeKey}`;
  const [loaded, setLoaded] = useState<{ key: string; trees: Record<string, ReleaseNode> }>({ key: loadKey, trees: {} });
  const [error, setError] = useState<string>();
  /** Incremented to load the trees again after a failure */
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    getAccessToken()
      .then((token) =>
        Promise.all(
          scopeKey.split("\n").filter(Boolean).map((scope) =>
            fetchReleaseTree(token, instanceId, scope).then((tree) => {
              if (!cancelled) {
                setLoaded((current) => ({
                  key: loadKey,
                  trees: { ...(current.key === loadKey ? current.trees : {}), [scope]: tree },
                }));
              }
            }),
          ),
        ),
      )
      .catch((e: unknown) => {
        console.error("Failed to load the instances in scope", e);
        if (!cancelled) {
          setError(errorMessage(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, instanceId, scopeKey, loadKey, retryCount]);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  return { trees: loaded.key === loadKey ? loaded.trees : {}, error, retry };
}

/**
 * The instances an invitation covers: the instance and the instances reached by the selected scopes of its type
 * (merged) - undefined as long as the trees of the selected scopes aren't loaded.
 */
function useCoveredInstances(scopes: string[], selected: string[], trees: Record<string, ReleaseNode>) {
  const selectedScopes = scopes.filter((scope) => selected.includes(scope));
  const complete = selectedScopes.every((scope) => trees[scope]);
  /** Any tree tells the instance itself - which is all that is covered without a scope */
  const anyTree = scopes.map((scope) => trees[scope]).find(Boolean);
  const selectionKey = selectedScopes.join("\n");

  const tree = useMemo(() => {
    if (!complete || !anyTree) {
      return undefined;
    }
    return selectedScopes.length === 0
      ? { ...anyTree, children: [] }
      : prepareReleaseTree(mergeTrees(selectedScopes.map((scope) => trees[scope])));
  }, [complete, anyTree, trees, selectionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const entries = useMemo(() => (tree ? flattenReleaseTree(tree, {}, false) : undefined), [tree]);
  return tree && entries ? { tree, entries } : undefined;
}

/** The instances the invitation being created covers - following the scopes selected. */
function CoveredInstances({
  scopes,
  selected,
  scopeTrees,
  onInstanceClick,
}: {
  scopes: string[];
  selected: string[];
  scopeTrees: ScopeTrees;
  onInstanceClick?: (instanceId: string) => void;
}) {
  const covered = useCoveredInstances(scopes, selected, scopeTrees.trees);
  const labelId = useId();

  return (
    <div className="instance-review-covered" role="group" aria-labelledby={labelId}>
      <div id={labelId} className="instance-review-legend">
        Instances covered
        {covered && <span className="instance-review-count">{covered.entries.length}</span>}
      </div>
      <CoveredTree covered={covered} scopeTrees={scopeTrees} onInstanceClick={onInstanceClick} />
    </div>
  );
}

/** The instances an existing invitation covers - collapsed, its number only, until expanded. */
function CoveredInstancesToggle({
  scopes,
  selected,
  scopeTrees,
  onInstanceClick,
}: {
  scopes: string[];
  selected: string[];
  scopeTrees: ScopeTrees;
  onInstanceClick?: (instanceId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const covered = useCoveredInstances(scopes, selected, scopeTrees.trees);
  const treeId = useId();

  if (scopes.length === 0) {
    return null;
  }
  return (
    <div className="instance-review-covered-toggle">
      <button
        type="button"
        className="instance-review-disclosure"
        aria-expanded={expanded}
        aria-controls={treeId}
        onClick={() => setExpanded((current) => !current)}
      >
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="me-2" aria-hidden="true" />
        Instances covered
        {covered && <span className="instance-review-count">{covered.entries.length}</span>}
      </button>
      {expanded && (
        <div id={treeId}>
          <CoveredTree covered={covered} scopeTrees={scopeTrees} onInstanceClick={onInstanceClick} />
        </div>
      )}
    </div>
  );
}

function CoveredTree({
  covered,
  scopeTrees: { error, retry },
  onInstanceClick,
}: {
  covered: ReturnType<typeof useCoveredInstances>;
  scopeTrees: ScopeTrees;
  onInstanceClick?: (instanceId: string) => void;
}) {
  if (!covered) {
    return error ? (
      <Alert variant="danger" className="mb-0">
        {error}
        <div className="mt-2">
          <Button size="sm" variant="outline-danger" onClick={retry}>
            Retry
          </Button>
        </div>
      </Alert>
    ) : (
      <div className="instance-review-tree instance-review-hint" role="status">
        <Spinner animation="border" size="sm" className="me-2" />
        Loading instances...
      </div>
    );
  }
  const { tree, entries } = covered;
  return (
    <ul className="release-tree instance-review-tree" aria-label="Instances covered">
      {entries.map(({ node, level }) => (
        <li
          key={node.instanceId}
          className="release-node release-node--readonly"
          style={{ "--release-level": level } as React.CSSProperties}
        >
          <div className="release-node-status">
            <StatusTag status={node.releaseStatus} />
          </div>
          <ReleaseNodeLabel
            node={node}
            isTop={node.instanceId === tree.instanceId}
            onInstanceClick={onInstanceClick}
          />
        </li>
      ))}
    </ul>
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
