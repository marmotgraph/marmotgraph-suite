import React, { ReactNode } from "react";
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function useAuth() {
  return { keycloak: {} as never, getAccessToken: async () => "preview", logout: undefined };
}
