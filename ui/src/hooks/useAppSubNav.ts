// src/hooks/useAppSubNav.ts
import { useLocation } from "react-router-dom";
import { queryBuilderSubNav } from "../modules/query-builder/querySubNav";
import { editorSubNav } from "../modules/editor/editorSubNav";
import { visualizerSubNav } from "../modules/visualizer/visualizerSubNav";
import { modelerSubNav } from "../modules/modeler/modelerSubNav";
import { apiSubNav } from "../modules/api/apiSubNav";
import { adminSubNav } from "../modules/admin/adminSubNav";
import { spacesSubNav } from "../modules/spaces/spacesSubNav";
import { statisticsSubNav } from "../modules/statistics/statisticsSubNav";

export function useAppSubNav() {
  const { pathname } = useLocation();

  // Home page – no sub‑nav
  if (pathname === "/" || pathname === "/home") {
    return undefined;
  }

  // Other routes
  if (pathname.startsWith("/queries")) return queryBuilderSubNav;
  if (pathname.startsWith("/editor")) return editorSubNav;
  if (pathname.startsWith("/visualizer")) return visualizerSubNav;
  if (pathname.startsWith("/modeler")) return modelerSubNav;
  if (pathname.startsWith("/core-api")) return apiSubNav;
  if (pathname.startsWith("/spaces")) return spacesSubNav;
  if (pathname.startsWith("/statistics")) return statisticsSubNav;
  if (pathname.startsWith("/admin")) return adminSubNav(pathname);

  // Fallback – no sub‑nav
  return undefined;
}
