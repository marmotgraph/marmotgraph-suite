import { getJson, send } from "./http";

/**
 * An invitation link which hasn't been redeemed yet - the token is only provided when it is created (it can't be
 * retrieved again). The timestamps are ISO-8601.
 */
export interface InvitationLink {
  id: string;
  label?: string;
  scopes: string[];
  createdAt?: string;
  expiresAt?: string;
  token?: string;
}

/**
 * The invitations of an instance - the scopes are the names of the scopes defined for its type. The scopes and the
 * invited users are missing if the user isn't allowed to list them.
 */
export interface InstanceInvitations {
  scopes?: string[];
  /** The usernames of the invited users */
  invitedUsers?: string[];
  pendingInvitations: InvitationLink[];
}

/** A known user who can be invited - the name falls back to the username. */
export interface InvitationCandidate {
  id: string;
  username: string;
  name: string;
}

/** The least number of characters the core searches the users with */
export const MIN_CANDIDATE_SEARCH_LENGTH = 3;

/** The longest label the core accepts for an invitation link */
export const MAX_INVITATION_LABEL_LENGTH = 255;

function invitationsUrl(instanceId: string, path: string) {
  return `/api/instances/${encodeURIComponent(instanceId)}/${path}`;
}

/** Fetches the invited users, the pending invitation links and the scopes of an instance. */
export function fetchInvitations(
  accessToken: string,
  instanceId: string,
): Promise<InstanceInvitations> {
  return getJson(invitationsUrl(instanceId, "invitations"), "the invitations", accessToken);
}

/** Searches the known users to invite - by their email address (exactly), username or name. */
export function searchInvitationCandidates(
  accessToken: string,
  instanceId: string,
  search: string,
): Promise<InvitationCandidate[]> {
  return getJson(
    `${invitationsUrl(instanceId, "invitationCandidates")}?${new URLSearchParams({ search })}`,
    "the users",
    accessToken,
  );
}

/** Invites a known user for the instance and the given scopes of its type (all of them if none are given). */
export function inviteUser(
  accessToken: string,
  instanceId: string,
  userId: string,
  scopes: string[],
): Promise<void> {
  return send(
    "PUT",
    invitationsUrl(instanceId, `invitedUsers/${encodeURIComponent(userId)}`),
    "invite the user",
    accessToken,
    { scopes },
  );
}

/** Revokes the invitation of the user with the given username. */
export function revokeUserInvitation(
  accessToken: string,
  instanceId: string,
  username: string,
): Promise<void> {
  return send(
    "DELETE",
    `${invitationsUrl(instanceId, "invitedUsers")}?${new URLSearchParams({ username })}`,
    "remove the invitation",
    accessToken,
  );
}

/** Creates an invitation link - the returned token is only provided once. */
export function createInvitationLink(
  accessToken: string,
  instanceId: string,
  label: string,
  scopes: string[],
): Promise<InvitationLink> {
  return send(
    "POST",
    invitationsUrl(instanceId, "pendingInvitations"),
    "create the invitation link",
    accessToken,
    { label, scopes },
  );
}

/** Revokes an invitation link which hasn't been redeemed yet. */
export function revokeInvitationLink(
  accessToken: string,
  instanceId: string,
  invitationId: string,
): Promise<void> {
  return send(
    "DELETE",
    invitationsUrl(instanceId, `pendingInvitations/${encodeURIComponent(invitationId)}`),
    "remove the invitation link",
    accessToken,
  );
}

/** The path of the page redeeming an invitation (see InvitationRedemption) */
export const INVITATION_PATH = "/invitations";

/** The link to hand out to the invitee - it opens the page redeeming the invitation. */
export function invitationUrl(token: string, origin = window.location.origin): string {
  return `${origin}${INVITATION_PATH}/${encodeURIComponent(token)}`;
}

/** The redemptions in flight by their token - a token can only be redeemed once, so a repeated attempt shares the first. */
const redemptions = new Map<string, Promise<string>>();

/** Redeems an invitation for the current user - provides the id of the instance it was issued for. */
export function redeemInvitation(accessToken: string, token: string): Promise<string> {
  let redemption = redemptions.get(token);
  if (!redemption) {
    redemption = send<{ instanceId: string }>(
      "POST",
      "/api/invitations/redemption",
      "accept the invitation",
      accessToken,
      { token },
    ).then((result) => result.instanceId);
    // Failures can be retried - successful redemptions are kept (the token is used up)
    redemption.catch(() => redemptions.delete(token));
    redemptions.set(token, redemption);
  }
  return redemption;
}
