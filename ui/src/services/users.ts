export interface UserInfo {
  userName?: string;
  displayName?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  nativeId?: string;
}

/** Fetches the information about the user the given access token belongs to. */
export async function fetchCurrentUser(accessToken: string): Promise<UserInfo> {
  const response = await fetch("/api/users/me", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to load the user information (${response.status} ${response.statusText})`,
    );
  }
  return (await response.json()) as UserInfo;
}

/** The name to show for the user - falls back to the user name if there is no display name. */
export function userLabel(user: UserInfo): string | undefined {
  return (
    user.displayName ||
    [user.givenName, user.familyName].filter(Boolean).join(" ") ||
    user.userName
  );
}
