import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchCurrentUser, UserInfo } from "../services/users";

/** Loads the information about the logged in user - undefined until it is available (or if loading failed). */
export function useCurrentUser(): UserInfo | undefined {
  const { getAccessToken } = useAuth();
  const [user, setUser] = useState<UserInfo>();

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then(fetchCurrentUser)
      .then((u) => !cancelled && setUser(u))
      .catch((e: unknown) =>
        console.error("Failed to load the current user", e),
      );
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  return user;
}
