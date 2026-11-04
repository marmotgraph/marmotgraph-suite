import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const embedding = vi.hoisted(() => ({
  isEmbedded: vi.fn(),
  isSignInWindow: vi.fn(),
  handOverTokens: vi.fn(),
  openSignInWindow: vi.fn(),
}));

type FakeKeycloak = Record<string, unknown> & { init: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn> };
const keycloaks = vi.hoisted(() => ({ created: [] as unknown[], authenticated: true }));

vi.mock("../services/embedding", () => embedding);
vi.mock("./ConfigContext", () => ({ useConfig: () => ({ authUrl: "a", authTokenUrl: "t", authClientId: "c" }) }));
vi.mock("keycloak-js", () => ({
  default: class {
    authenticated = false;
    token = "token";
    refreshToken = "refresh";
    idToken = "id";
    login = vi.fn();
    init = vi.fn(async () => {
      this.authenticated = keycloaks.authenticated;
    });
    constructor() {
      keycloaks.created.push(this);
    }
  },
}));

const renderProvider = async () => {
  vi.resetModules(); // the keycloak instance is shared on module level
  const { AuthProvider } = await import("./AuthContext");
  await act(async () => {
    render(
      <AuthProvider>
        <div>app</div>
      </AuthProvider>,
    );
  });
};
const last = () => keycloaks.created[keycloaks.created.length - 1] as FakeKeycloak;

describe("AuthProvider", () => {
  beforeEach(() => {
    keycloaks.created = [];
    keycloaks.authenticated = true;
    embedding.isEmbedded.mockReturnValue(false);
    embedding.isSignInWindow.mockReturnValue(false);
    embedding.handOverTokens.mockReset();
    embedding.openSignInWindow.mockReset();
  });

  it("requires the login by redirect on its own", async () => {
    await renderProvider();

    expect(last().init).toHaveBeenCalledWith(expect.objectContaining({ onLoad: "login-required" }));
    expect(screen.getByText("app")).toBeInTheDocument();
  });

  it("only checks for an existing session when embedded", async () => {
    embedding.isEmbedded.mockReturnValue(true);
    await renderProvider();

    expect(last().init).toHaveBeenCalledWith(
      expect.objectContaining({
        onLoad: "check-sso",
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        silentCheckSsoFallback: false,
      }),
    );
    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("asks to sign in in a window if embedded without session and takes over its tokens", async () => {
    embedding.isEmbedded.mockReturnValue(true);
    keycloaks.authenticated = false;
    await renderProvider();
    expect(screen.queryByText("app")).not.toBeInTheDocument();
    expect(last().login).not.toHaveBeenCalled();

    embedding.openSignInWindow.mockReturnValue(() => undefined);
    act(() => screen.getByRole("button", { name: "Sign in" }).click());
    const onTokens = embedding.openSignInWindow.mock.calls[0][0];

    keycloaks.authenticated = true;
    await act(async () => onTokens({ token: "t", refreshToken: "r", idToken: "i" }));

    expect(keycloaks.created).toHaveLength(2);
    expect(last().init).toHaveBeenCalledWith(expect.objectContaining({ token: "t", refreshToken: "r", idToken: "i" }));
    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("says so if the browser blocks the sign-in window", async () => {
    embedding.isEmbedded.mockReturnValue(true);
    keycloaks.authenticated = false;
    await renderProvider();

    embedding.openSignInWindow.mockReturnValue(undefined);
    act(() => screen.getByRole("button", { name: "Sign in" }).click());

    expect(screen.getByText(/blocked the window/)).toBeInTheDocument();
  });

  it("keeps the page when the session of an embedded suite ends", async () => {
    embedding.isEmbedded.mockReturnValue(true);
    await renderProvider();

    act(() => (last().onAuthLogout as () => void)());

    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("hands the tokens over instead of showing the app in the sign-in window", async () => {
    embedding.isSignInWindow.mockReturnValue(true);
    await renderProvider();

    expect(embedding.handOverTokens).toHaveBeenCalledWith({ token: "token", refreshToken: "refresh", idToken: "id" });
    expect(screen.queryByText("app")).not.toBeInTheDocument();
  });
});
