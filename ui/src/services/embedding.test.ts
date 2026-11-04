import { afterEach, describe, expect, it, vi } from "vitest";
import { handOverTokens, isSignInWindow, openSignInWindow } from "./embedding";

const message = (origin: string, source: Window | null, data: unknown) =>
  window.dispatchEvent(new MessageEvent("message", { origin, source, data }));

describe("embedding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("reports a blocked sign-in window", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(openSignInWindow(vi.fn())).toBeUndefined();
  });

  it("only accepts tokens from the sign-in window on the own origin", () => {
    const signInWindow = window;
    vi.spyOn(window, "open").mockReturnValue(signInWindow);
    const onTokens = vi.fn();
    const stop = openSignInWindow(onTokens)!;
    const data = { type: "marmotgraph-embedded-sign-in", token: "t", refreshToken: "r", idToken: "i" };

    message("https://evil.example.org", signInWindow, data);
    message(window.location.origin, null, data);
    message(window.location.origin, signInWindow, { type: "other", token: "t" });
    expect(onTokens).not.toHaveBeenCalled();

    message(window.location.origin, signInWindow, data);
    expect(onTokens).toHaveBeenCalledWith({ token: "t", refreshToken: "r", idToken: "i" });
    stop();
  });

  it("hands the tokens over to the own origin only", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("opener", { postMessage });
    vi.spyOn(window, "close").mockImplementation(() => undefined);

    handOverTokens({ token: "t" });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ token: "t" }), window.location.origin);
    expect(window.close).toHaveBeenCalled();
  });

  it("only is a sign-in window if opened as one", () => {
    window.history.replaceState(null, "", "/?embeddedSignIn=1");
    expect(isSignInWindow()).toBe(false);

    vi.stubGlobal("opener", {});
    expect(isSignInWindow()).toBe(true);

    window.history.replaceState(null, "", "/");
    expect(isSignInWindow()).toBe(false);
  });
});
