import { getJson, send } from "./http";

/** A comment of a reviewer on an instance or on one of its properties. */
export interface InstanceComment {
  id: string;
  /** The property the comment is about - missing if it is about the instance as a whole */
  property?: string;
  text: string;
  createdAt: string;
  /** The time of the last edit - missing if the comment has never been edited */
  updatedAt?: string;
  /** Whether the comment has been written by the current user */
  own: boolean;
  /** The author - missing if the user may not see who has written the comment */
  createdBy?: { username: string; name: string };
}

const commentsUrl = (instanceId: string) => `/api/instances/${encodeURIComponent(instanceId)}/comments`;

/** Fetches the comments on an instance and its properties, the oldest first. */
export function fetchComments(accessToken: string, instanceId: string): Promise<InstanceComment[]> {
  return getJson(commentsUrl(instanceId), "the comments", accessToken);
}

/** Adds a comment on the given property - or on the instance as a whole if there is none. */
export function addComment(
  accessToken: string,
  instanceId: string,
  property: string | undefined,
  text: string,
): Promise<InstanceComment> {
  return send("POST", commentsUrl(instanceId), "add the comment", accessToken, { property, text });
}

/** Replaces the text of a comment of the user. */
export function updateComment(
  accessToken: string,
  instanceId: string,
  commentId: string,
  text: string,
): Promise<InstanceComment> {
  return send(
    "PUT",
    `${commentsUrl(instanceId)}/${encodeURIComponent(commentId)}`,
    "update the comment",
    accessToken,
    { text },
  );
}

/** Deletes a comment. */
export function deleteComment(accessToken: string, instanceId: string, commentId: string): Promise<void> {
  return send(
    "DELETE",
    `${commentsUrl(instanceId)}/${encodeURIComponent(commentId)}`,
    "delete the comment",
    accessToken,
  );
}
