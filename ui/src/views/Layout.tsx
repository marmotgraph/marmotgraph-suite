import React, { useEffect, useState } from "react";
import SidebarMG from "../components/SidebarMG";
import AppSubNav from "../components/composites/AppSubNav";
import Footer from "../components/composites/Footer";
import { useAppSubNav } from "../hooks/useAppSubNav";
import { SubNavActionsProvider } from "../contexts/SubNavActionsContext";
import { MOBILE_VIEWPORT_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import "./Layout.css";

interface LayoutProps {
  subNav?: {
    title?: React.ReactNode;
    ctas: {
      label: string;
      href?: string;
      icon?: React.ReactNode;
      variant?:
        | "primary"
        | "secondary"
        | "outline-primary"
        | "outline-secondary"
        | "dark"
        | "outline-dark";
      size?: "sm" | "lg"; // ← Removed "md"
      modal?: {
        show: boolean;
        title: string;
        body: React.ReactNode;
        onClose: () => void;
      };
    }[];
  };
  children: React.ReactNode;
}

function sidebarStartsCollapsed() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
  );
}

export default function Layout({ subNav, children }: LayoutProps) {
  const isMobile = useMediaQuery(MOBILE_VIEWPORT_QUERY);
  // A phone starts with the icon rail. Opening the full sidebar is still one tap away.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(sidebarStartsCollapsed);
  useEffect(() => {
    if (isMobile) {
      setIsSidebarCollapsed(true);
    }
  }, [isMobile]);
  const routeSubNav = useAppSubNav();
  const effectiveSubNav = subNav ?? routeSubNav;

  return (
    <SubNavActionsProvider>
      <div className="d-flex layout-container">
        <SidebarMG
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <div className="d-flex flex-column layout-content">
          {effectiveSubNav && (
            <div className="layout-subnav-wrapper">
              <AppSubNav
                title={effectiveSubNav.title}
                ctas={effectiveSubNav.ctas}
              />
            </div>
          )}

          <main className="px-4 layout-main">{children}</main>

          <div className="layout-footer-wrapper">
            <Footer />
          </div>
        </div>
      </div>
    </SubNavActionsProvider>
  );
}
