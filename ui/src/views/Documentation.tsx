import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Where the service serves the documentation (suite, core and deployment) - see Documentation.java. */
const DOCS_ROOT = "/docs/";
/** The route which shows it within the suite. */
export const DOCUMENTATION_ROOT = "/documentation/";

type Address = Pick<Location, "pathname" | "search" | "hash">;

/** The page of the documentation a route of the suite shows, e.g. /documentation/core/index.html -> /docs/core/index.html */
export function docsPage({ pathname, search, hash }: Address): string {
  const page = pathname.startsWith(DOCUMENTATION_ROOT) ? pathname.slice(DOCUMENTATION_ROOT.length) : "";
  return `${DOCS_ROOT}${page}${search}${hash}`;
}

/** The route of the suite which shows a page of the documentation - undefined if the page isn't part of it. */
export function documentationRoute({ pathname, search, hash }: Address): string | undefined {
  if (pathname === DOCS_ROOT.slice(0, -1)) {
    return `${DOCUMENTATION_ROOT}${search}${hash}`;
  }
  return pathname.startsWith(DOCS_ROOT)
    ? `${DOCUMENTATION_ROOT}${pathname.slice(DOCS_ROOT.length)}${search}${hash}`
    : undefined;
}

const address = ({ pathname, search, hash }: Address) => `${pathname}${search}${hash}`;

/**
 * Shows the documentation next to the navigation of the suite. The route follows the page in the frame, so it can be
 * shared and opened again - and links which leave the documentation open in the suite (or, if external, in a new tab)
 * instead of inside of the frame.
 */
export default function Documentation() {
  const location = useLocation();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const page = docsPage(location);
  // The frame navigates on its own - it only starts at the page of the route
  const [initialPage] = useState(page);
  const shownPage = useRef(initialPage);
  const currentRoute = useRef(address(location));
  currentRoute.current = address(location);

  useEffect(() => {
    // The route changed outside of the frame (e.g. by the sidebar) - lead the frame there
    if (page !== shownPage.current) {
      shownPage.current = page;
      frameRef.current?.contentWindow?.location.replace(page);
    }
  }, [page]);

  const follow = useCallback(
    (frameLocation: Address) => {
      const route = documentationRoute(frameLocation);
      if (!route) {
        // E.g. the 404 page of the service leads back to the suite - which isn't shown inside of itself
        navigate(address(frameLocation));
        return;
      }
      shownPage.current = address(frameLocation);
      if (route !== currentRoute.current) {
        // The frame keeps its own history - the back button of the browser already steps through it
        navigate(route, { replace: true });
      }
    },
    [navigate],
  );

  const handleLoad = useCallback(() => {
    const frameWindow = frameRef.current?.contentWindow;
    let frameDocument: Document;
    try {
      frameDocument = frameWindow!.document;
    } catch {
      // Not of the same origin - nothing to follow
      return;
    }
    const frame = frameWindow!;
    follow(frame.location);
    frame.addEventListener("hashchange", () => follow(frame.location));
    frameDocument.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      // The elements belong to the window of the frame - instanceof Element doesn't hold for them
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self")) {
        return;
      }
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) {
        event.preventDefault();
        window.open(url.href, "_blank", "noopener");
      } else if (!documentationRoute(url)) {
        event.preventDefault();
        navigate(address(url));
      }
    });
  }, [follow, navigate]);

  return (
    <iframe ref={frameRef} className="layout-documentation-frame" src={initialPage} title="Documentation" onLoad={handleLoad} />
  );
}
