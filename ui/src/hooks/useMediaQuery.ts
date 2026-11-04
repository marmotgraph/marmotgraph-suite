import { useEffect, useState } from "react";

/** Phone-width layout, shared by the editor list and the sidebar. */
export const MOBILE_VIEWPORT_QUERY = "(max-width: 768px)";

export function useMediaQuery(query: string) {
  const getMatch = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    if (typeof media.addListener === "function") {
      media.addListener(onChange);
      return () => media.removeListener(onChange);
    }
  }, [query]);

  return matches;
}
