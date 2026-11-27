import React, { useEffect, useState } from "react";
import { Button, Spinner } from "react-bootstrap";
import { ServiceUnavailableError, UnavailableService } from "../services/config";
import Footer from "./composites/Footer";
import AnimatedIllustration from "./AnimatedIllustration";
import MarmotError from "../assets/marmot-error.svg?react";
import "../views/Layout.css";
import "../modules/home/SuiteHome.css";
import "./Outage.css";

/** A moment of the (6s) animation where the cable is cut - the still image if reduced motion is asked for */
const STILL_FRAME_S = 3.6;

const DESCRIPTIONS: Record<UnavailableService, { title: string; text: string }> = {
  core: {
    title: "The knowledge graph can't be reached right now",
    text: "The suite depends on the MarmotGraph core, which is currently not responding. Signing in and the modules are unavailable until the connection is back.",
  },
  suite: {
    title: "The suite can't be reached right now",
    text: "The server of the suite is currently not responding. Signing in and the modules are unavailable until the connection is back.",
  },
};

interface OutageProps {
  /** The last failed attempt - a new one restarts the countdown */
  outage: ServiceUnavailableError;
  /** An attempt to reach the core is in flight */
  checking: boolean;
  onRetry: () => void;
}

/**
 * The landing page while the suite backend or the MarmotGraph core behind it can't be reached - e.g. when the page
 * itself comes from the cache of the browser. Nothing depending on them (the login, the modules) is offered - the connection is retried in the interval given by the backend (or right away on demand / when the
 * browser gets back online) and the suite starts as soon as the core is back.
 */
export default function Outage({ outage, checking, onRetry }: Readonly<OutageProps>) {
  const [remaining, setRemaining] = useState(outage.retryInterval);

  // The countdown (re)starts after each failed attempt - and pauses while one is in flight
  useEffect(() => {
    if (checking) {
      return;
    }
    const deadline = Date.now() + outage.retryInterval * 1000;
    setRemaining(outage.retryInterval);
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(timer);
        onRetry();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [outage, checking, onRetry]);

  useEffect(() => {
    if (checking) {
      return;
    }
    window.addEventListener("online", onRetry);
    return () => window.removeEventListener("online", onRetry);
  }, [checking, onRetry]);

  const { tenant } = outage;
  const { title, text } = DESCRIPTIONS[outage.service];
  return (
    <div className="outage">
      <div className="d-flex flex-column layout-content">
        <main className="outage-main">
          <div className="outage-body">
            <header className="suite-home-header">
              <h1 className="suite-home-title">{tenant ? `${tenant} Knowledge Graph Suite` : "Knowledge Graph Suite"}</h1>
            </header>
            <section className="outage-card" aria-labelledby="outage-title">
              <AnimatedIllustration svg={MarmotError} stillFrame={STILL_FRAME_S} className="outage-illustration" />
              <div className="outage-kicker">
                <span className="outage-status">
                  <span className="outage-status-dot" aria-hidden="true" />
                  Unavailable
                </span>
                Service status
              </div>
              <h2 id="outage-title" className="outage-title">
                {title}
              </h2>
              <p className="outage-text">
                {text} This page reconnects on its own - there is no need to reload it.
              </p>
              <details className="outage-details">
                <summary>Technical details</summary>
                <code>{outage.message}</code>
              </details>
              <div className="outage-retry">
                <span className="outage-retry-state">
                  {checking && <Spinner animation="border" size="sm" aria-hidden="true" />}
                  <span role="status">{checking ? "Checking the connection..." : "Still not reachable."}</span>
                  {!checking && <span>Next attempt in {remaining}s</span>}
                </span>
                <Button variant="outline-secondary" size="sm" onClick={onRetry} disabled={checking}>
                  Retry now
                </Button>
              </div>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
