import React, { ReactNode } from "react";
import AnimatedIllustration from "./AnimatedIllustration";
import MarmotLost from "../assets/marmot-404.svg?react";
import MarmotError from "../assets/marmot-error.svg?react";
import MarmotRefused from "../assets/marmot-400.svg?react";
import "../views/Layout.css";

/** The illustrations with the moment of their animation shown as still image if reduced motion is asked for */
const ILLUSTRATIONS = {
  /** The marmot lost in its tunnels (7s) - looking around puzzled */
  lost: { svg: MarmotLost, stillFrame: 1.8 },
  /** The eagle snatching the marmot (8s) - the eagle has it in its claws */
  refused: { svg: MarmotRefused, stillFrame: 3.2 },
  /** The marmot biting through a cable (6s) - the cable is cut */
  error: { svg: MarmotError, stillFrame: 3.6 },
};

export type Illustration = keyof typeof ILLUSTRATIONS;

/**
 * The illustration for a failed request: "refused" for the client errors (4xx, e.g. no access) - "error" for everything
 * else (5xx, no response at all). A missing resource (404) is "lost" - callers decide on that themselves, since e.g. a
 * 400 for an invalid id means the same.
 */
export function illustrationForStatus(status: number | undefined): Illustration {
  return status !== undefined && status >= 400 && status < 500 ? "refused" : "error";
}

interface ProblemMessageProps {
  /** "lost" for something that doesn't exist (404), "refused" for a request that was refused (other 4xx), "error" for something that failed */
  illustration: Illustration;
  /** e.g. "Error 404" */
  kicker: string;
  title: string;
  children: ReactNode;
  /** The ways on - at most one of them styled as the dark page action */
  actions?: ReactNode;
}

/** A page-sized message about something that went wrong - e.g. a page or an instance that doesn't exist. */
export default function ProblemMessage({ illustration, kicker, title, children, actions }: Readonly<ProblemMessageProps>) {
  const { svg, stillFrame } = ILLUSTRATIONS[illustration];
  return (
    <div className="layout-not-found">
      <AnimatedIllustration svg={svg} stillFrame={stillFrame} className="layout-not-found-illustration" />
      <p className="layout-not-found-kicker">{kicker}</p>
      <h1 className="layout-not-found-title">{title}</h1>
      <div className="layout-not-found-text">{children}</div>
      {actions && <div className="layout-not-found-actions">{actions}</div>}
    </div>
  );
}
