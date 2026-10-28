import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import Keycloak from "keycloak-js";
import { useConfig } from "./ConfigContext";
import { AppConfig } from "../services/config";
import StartupStatus from "../components/StartupStatus";

/** Refresh the access token if it expires within this many seconds */
const MIN_TOKEN_VALIDITY_S = 30;

interface AuthContextType {
  keycloak: Keycloak;
  /** Returns a valid access token (refreshed if it is about to expire) - to be sent as bearer token */
  getAccessToken: () => Promise<string>;
  /** Terminates the session at the OIDC provider and returns to the app (only defined if supported by the provider) */
  logout?: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * keycloak.init() must only be called once per instance - since React StrictMode runs effects
 * twice in development, the instance and its initialization are shared on module level.
 */
let initialization: Promise<Keycloak> | undefined;

function initialize(config: AppConfig): Promise<Keycloak> {
  if (!initialization) {
    const keycloak = new Keycloak({
      clientId: config.authClientId,
      oidcProvider: {
        authorization_endpoint: config.authUrl,
        token_endpoint: config.authTokenUrl,
        end_session_endpoint: config.authLogoutUrl,
      },
    });
    // If the refresh token is rejected, keycloak clears the tokens and redirects to the login (due to "login-required").
    // Other failures (e.g. network issues) are retried with the next request - see getAccessToken.
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(MIN_TOKEN_VALIDITY_S).catch(() => undefined);
    };
    initialization = keycloak
      .init({
        onLoad: "login-required",
        pkceMethod: "S256",
        // The session iframe requires an endpoint which isn't part of the config
        checkLoginIframe: false,
      })
      .then(() => keycloak);
    initialization.catch(() => (initialization = undefined));
  }
  return initialization;
}

/** Ensures the user is authenticated (authorization code flow with PKCE) before rendering its children. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  const [keycloak, setKeycloak] = useState<Keycloak>();
  const [error, setError] = useState<string>();

  const init = useCallback(() => {
    setError(undefined);
    initialize(config)
      .then((kc) => {
        // With "login-required", an unauthenticated init redirects to the login page
        if (kc.authenticated) {
          setKeycloak(kc);
        }
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : (e as { error?: string })?.error ?? "unknown error"),
      );
  }, [config]);

  useEffect(init, [init]);

  const getAccessToken = useCallback(async () => {
    if (!keycloak) {
      throw new Error("Not authenticated");
    }
    try {
      await keycloak.updateToken(MIN_TOKEN_VALIDITY_S);
    } catch (e) {
      // A rejected refresh token already triggered the login (and cleared the authentication) - only a session for which
      // the provider didn't issue a refresh token needs a new one. Other failures are retried with the next request.
      if (keycloak.authenticated && !keycloak.refreshToken) {
        await keycloak.login();
      }
      throw e;
    }
    return keycloak.token!;
  }, [keycloak]);

  // After the logout, the user lands on the start page again - which requires a new login
  const logout = useCallback(
    () => keycloak!.logout({ redirectUri: window.location.origin + "/" }),
    [keycloak],
  );

  if (error) {
    return <StartupStatus error={`Authentication failed: ${error}`} onRetry={init} />;
  }
  if (!keycloak) {
    return <StartupStatus message="Signing in..." />;
  }
  return (
    <AuthContext.Provider value={{ keycloak, getAccessToken, logout: config.authLogoutUrl ? logout : undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
