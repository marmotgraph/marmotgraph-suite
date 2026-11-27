import React, { useEffect, useRef } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface AnimatedIllustrationProps {
  /** The illustration imported as component (`*.svg?react`) - inlined instead of an <img> so its animation can be stopped */
  svg: React.FunctionComponent<React.ComponentProps<"svg">>;
  /** The moment of the animation (in seconds) shown as still image if reduced motion is asked for */
  stillFrame: number;
  className?: string;
}

/**
 * An animated (SMIL) illustration - frozen at a telling moment if the user asks for reduced motion. Decorative: the text
 * next to it says what happened, so it is hidden from assistive technology.
 */
export default function AnimatedIllustration({ svg: Svg, stillFrame, className }: Readonly<AnimatedIllustrationProps>) {
  const container = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const svg = container.current?.querySelector("svg");
    // Not available in every environment (e.g. jsdom)
    if (!svg || typeof svg.pauseAnimations !== "function") {
      return;
    }
    if (reducedMotion) {
      svg.pauseAnimations();
      svg.setCurrentTime(stillFrame);
    } else {
      svg.unpauseAnimations();
    }
  }, [reducedMotion, stillFrame]);

  return (
    <div ref={container} className={className} aria-hidden="true">
      <Svg focusable="false" />
    </div>
  );
}
