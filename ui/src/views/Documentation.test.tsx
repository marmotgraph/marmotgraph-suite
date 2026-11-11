import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Documentation, { docsPage, documentationRoute } from "./Documentation";

function CurrentRoute() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="route">{`${pathname}${search}${hash}`}</output>;
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Link to="/documentation/">Documentation</Link>
      <CurrentRoute />
      <Routes>
        <Route path="documentation/*" element={<Documentation />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The window of the frame - jsdom doesn't load the documentation, so the test plays the page it shows. */
function showInFrame(page: string) {
  const frame = screen.getByTitle("Documentation") as HTMLIFrameElement;
  const url = new URL(page, window.location.origin);
  const frameDocument = document.implementation.createHTMLDocument("Documentation");
  const listeners: Record<string, () => void> = {};
  const frameWindow = {
    document: frameDocument,
    location: { pathname: url.pathname, search: url.search, hash: url.hash, replace: vi.fn() },
    addEventListener: (type: string, listener: () => void) => (listeners[type] = listener),
  };
  Object.defineProperty(frame, "contentWindow", { configurable: true, value: frameWindow });
  fireEvent.load(frame);
  return { frameWindow, frameDocument, listeners };
}

function linkIn(frameDocument: Document, href: string) {
  const link = frameDocument.createElement("a");
  link.href = new URL(href, window.location.origin).href;
  link.textContent = "Link";
  frameDocument.body.appendChild(link);
  return link;
}

const route = () => screen.getByTestId("route").textContent;

describe("Documentation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps the routes of the suite to the pages of the documentation and back", () => {
    expect(docsPage({ pathname: "/documentation/core/index.html", search: "?q=x", hash: "#a" })).toBe(
      "/docs/core/index.html?q=x#a",
    );
    expect(docsPage({ pathname: "/documentation", search: "", hash: "" })).toBe("/docs/");
    expect(documentationRoute({ pathname: "/docs/custom/index.html", search: "", hash: "#b" })).toBe(
      "/documentation/custom/index.html#b",
    );
    expect(documentationRoute({ pathname: "/docs", search: "", hash: "" })).toBe("/documentation/");
    expect(documentationRoute({ pathname: "/docsearch", search: "", hash: "" })).toBeUndefined();
    expect(documentationRoute({ pathname: "/editor", search: "", hash: "" })).toBeUndefined();
  });

  it("opens the page of the route in the frame", () => {
    renderAt("/documentation/core/index.html#setup");

    expect(screen.getByTitle("Documentation")).toHaveAttribute("src", "/docs/core/index.html#setup");
  });

  it("follows the page shown in the frame with the route", () => {
    renderAt("/documentation/");

    const { frameWindow, listeners } = showInFrame("/docs/modules/editor.html");
    expect(route()).toBe("/documentation/modules/editor.html");

    frameWindow.location.hash = "#links";
    act(() => listeners.hashchange());
    expect(route()).toBe("/documentation/modules/editor.html#links");
    // The frame is already there - it isn't led anywhere
    expect(frameWindow.location.replace).not.toHaveBeenCalled();
  });

  it("leads the frame to the page of a route changed outside of it", () => {
    renderAt("/documentation/modules/editor.html");
    const { frameWindow } = showInFrame("/docs/modules/editor.html");

    fireEvent.click(screen.getByRole("link", { name: "Documentation" }));

    expect(frameWindow.location.replace).toHaveBeenCalledWith("/docs/");
  });

  it("opens the pages of the suite within the suite instead of the frame", () => {
    renderAt("/documentation/");
    const { frameDocument } = showInFrame("/docs/missing.html");

    const link = linkIn(frameDocument, "/editor");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => {
      link.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(route()).toBe("/editor");
  });

  it("keeps the links within the documentation in the frame", () => {
    renderAt("/documentation/");
    const { frameDocument } = showInFrame("/docs/");

    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    linkIn(frameDocument, "/docs/core/index.html").dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("opens external links in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderAt("/documentation/");
    const { frameDocument } = showInFrame("/docs/");

    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    linkIn(frameDocument, "https://example.org/").dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith("https://example.org/", "_blank", "noopener");
  });

  it("leaves the frame when it shows a page of the suite", () => {
    renderAt("/documentation/");

    act(() => {
      showInFrame("/editor");
    });

    expect(route()).toBe("/editor");
  });
});
