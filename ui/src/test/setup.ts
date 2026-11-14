import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// findBy*/waitFor give up after 1 s by default - too tight when the whole suite runs in parallel on a CI runner.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no ResizeObserver; components that measure layout need a stub.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {
      // jsdom does not lay out - there is nothing to observe
    }
    unobserve() {
      // jsdom does not lay out - there is nothing to observe
    }
    disconnect() {
      // jsdom does not lay out - there is nothing to observe
    }
  };
}
