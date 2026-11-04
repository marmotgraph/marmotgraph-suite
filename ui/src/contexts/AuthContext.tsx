import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import Keycloak from "keycloak-js";
import { useConfig } from "./ConfigContext";
import { AppConfig } from "../services/config";
import StartupStatus from "../components/StartupStatus";
import EmbeddedSignIn from "../components/EmbeddedSignIn";
import { handOverTokens, isEmbedded, isSignInWindow, SignInTokens } from "../services/embedding";

/** Refresh the access token if it expires within this many seconds */
const MIN_TOKEN_VALIDITY_S = 30;
/** How long to wait for the silent sign-in of an embedded suite - it never completes if the provider blocks the request */
const SILENT_SIGN_IN_TIMEOUT_MS = 8000;

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

function initialize(config: AppConfig, onSignInRequired: () => void, tokens?: SignInTokens): Promise<Keycloak> {
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
    const options = {
      pkceMethod: "S256",
      // The session iframe requires an endpoint which isn't part of the config
      checkLoginIframe: false,
    } as const;
    if (isEmbedded()) {
      // The login can't be shown in an iframe: Only use a session the user already has - or ask to sign in (EmbeddedSignIn)
      keycloak.onAuthLogout = onSignInRequired;
      initialization = Promise.race([
        keycloak.init({
          ...options,
          ...tokens,
          onLoad: "check-sso",
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
          silentCheckSsoFallback: false,
        }),
        new Promise((resolve) => setTimeout(resolve, SILENT_SIGN_IN_TIMEOUT_MS)),
      ]).then(() => keycloak);
    } else {
      initialization = keycloak.init({ ...options, onLoad: "login-required" }).then(() => keycloak);
    }
    initialization.catch(() => (initialization = undefined));
  }
  return initialization;
}

/** Ensures the user is authenticated (authorization code flow with PKCE) before rendering its children. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  const [keycloak, setKeycloak] = useState<Keycloak>();
  const [error, setError] = useState<string>();
  const [signInRequired, setSignInRequired] = useState(false);

  const init = useCallback((tokens?: SignInTokens) => {
    setError(undefined);
    initialize(config, () => setSignInRequired(true), tokens)
      .then((kc) => {
        // With "login-required", an unauthenticated init redirects to the login page
        if (kc.authenticated) {
          if (isSignInWindow()) {
            handOverTokens({ token: kc.token!, refreshToken: kc.refreshToken, idToken: kc.idToken });
            return;
          }
          setSignInRequired(false);
          setKeycloak(kc);
        } else if (isEmbedded()) {
          setSignInRequired(true);
        }
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : (e as { error?: string })?.error ?? "unknown error"),
      );
  }, [config]);

  useEffect(() => init(), [init]);

  const signedIn = useCallback(
    (tokens: SignInTokens) => {
      // A keycloak instance can only be initialized once - the new one takes over from the tokens
      initialization = undefined;
      setSignInRequired(false);
      init(tokens);
    },
    [init],
  );

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
        if (isEmbedded()) {
          setSignInRequired(true);
        } else {
          await keycloak.login();
        }
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
    return <StartupStatus error={`Authentication failed: ${error}`} onRetry={() => init()} />;
  }
  const signIn = signInRequired && <EmbeddedSignIn onSignedIn={signedIn} />;
  if (!keycloak) {
    return signIn || <StartupStatus message="Signing in..." />;
  }
  // An expired session of an embedded suite keeps the page mounted so unsaved changes survive signing in again
  return (
    <AuthContext.Provider value={{ keycloak, getAccessToken, logout: config.authLogoutUrl ? logout : undefined }}>
      {children}
      {signIn}
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
