import { getJson } from "./http";

export interface UserInfo {
  userName?: string;
  displayName?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  nativeId?: string;
}

/** Fetches the information about the user the given access token belongs to. */
export function fetchCurrentUser(accessToken: string): Promise<UserInfo> {
  return getJson("/api/users/me", "the user information", accessToken);
}

/** The name to show for the user - falls back to the user name if there is no display name. */
export function userLabel(user: UserInfo): string | undefined {
  return (
    user.displayName ||
    [user.givenName, user.familyName].filter(Boolean).join(" ") ||
    user.userName
  );
}
