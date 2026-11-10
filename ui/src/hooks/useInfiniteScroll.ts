import { useEffect, useRef } from "react";

/**
 * Infinite scrolling: calls onLoadMore once the sentinel (an element below the loaded items) comes within 200px of the
 * end of the scroll container. The observer is recreated whenever it is enabled again (e.g. after each page), so it
 * fires again if the sentinel is still visible - e.g. if the items don't fill the container yet.
 *
 * @param enabled whether a further page can be loaded now - false while one is loading or if there is none
 */
export function useInfiniteScroll<Root extends HTMLElement, Sentinel extends HTMLElement>(
  enabled: boolean,
  onLoadMore: () => void,
) {
  const rootRef = useRef<Root>(null);
  const sentinelRef = useRef<Sentinel>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { root: rootRef.current, rootMargin: "0px 0px 200px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, onLoadMore]);

  return { rootRef, sentinelRef };
}
