import "@testing-library/jest-dom";

// jsdom has no ResizeObserver; components that measure layout need a stub.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
