/** Whether the suite runs inside of an iframe of another application - it shows a reduced view then (see Layout). */
export function isEmbedded(): boolean {
  return window.self !== window.top;
}

/** The tokens the sign-in window hands over to the embedded suite which opened it. */
export interface SignInTokens {
  token: string;
  refreshToken?: string;
  idToken?: string;
}

const SIGN_IN_PARAM = "embeddedSignIn";
const SIGN_IN_MESSAGE = "marmotgraph-embedded-sign-in";

/** Whether this window was opened by an embedded suite to sign in on its behalf. */
export function isSignInWindow(): boolean {
  return new URLSearchParams(window.location.search).has(SIGN_IN_PARAM) && Boolean(window.opener);
}

/** Passes the tokens to the embedded suite and closes the sign-in window - only a window of the same origin receives them. */
export function handOverTokens(tokens: SignInTokens) {
  (window.opener as Window).postMessage({ type: SIGN_IN_MESSAGE, ...tokens }, window.location.origin);
  window.close();
}

/**
 * The provider usually refuses to show its login inside of an iframe, so it happens in a window of its own.
 * Must be called from a user interaction - returns undefined if the browser blocked the window.
 */
export function openSignInWindow(onTokens: (tokens: SignInTokens) => void): (() => void) | undefined {
  const signInWindow = window.open(`/?${SIGN_IN_PARAM}=1`, SIGN_IN_MESSAGE, "popup,width=520,height=720");
  if (!signInWindow) {
    return undefined;
  }
  const onMessage = (event: MessageEvent) => {
    if (event.origin === window.location.origin && event.source === signInWindow && event.data?.type === SIGN_IN_MESSAGE) {
      window.removeEventListener("message", onMessage);
      const { token, refreshToken, idToken } = event.data as SignInTokens;
      onTokens({ token, refreshToken, idToken });
    }
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
