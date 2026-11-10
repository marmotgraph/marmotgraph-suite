import { EngineInput, ForceEngine } from "./forceEngine";
import type { ForceFrame, ForceRequest } from "./forceWorker";

export interface ForceHandle {
  pin(index: number, x: number, y: number): void;
  release(index: number): void;
  reheat(target: number): void;
  stop(): void;
}

export interface ForceOptions {
  /** Compute the result at once instead of animating it (reduced motion) */
  settle?: boolean;
}

/** Receives the positions (x, y, x, y, ...) - the array may be reused afterwards, so it has to be copied. */
export type OnFrame = (xy: Float32Array, running: boolean) => void;

const INLINE_BUDGET_MS = 8;
const INLINE_SETTLE_TICKS = 300;

function createWorker(): Worker | undefined {
  if (typeof Worker === "undefined") {
    return undefined;
  }
  try {
    return new Worker(new URL("./forceWorker.ts", import.meta.url), { type: "module" });
  } catch {
    return undefined;
  }
}

/** Without a worker the simulation shares the main thread, a few milliseconds per frame. */
function startInline(input: EngineInput, onFrame: OnFrame, options: ForceOptions): ForceHandle {
  const engine = new ForceEngine(input);
  const out = new Float32Array(engine.size * 2);
  let frame = 0;
  let stopped = false;

  const emit = (running: boolean) => {
    engine.write(out);
    onFrame(out, running);
  };
  const tick = () => {
    frame = 0;
    if (stopped) {
      return;
    }
    const running = engine.step(INLINE_BUDGET_MS);
    emit(running);
    if (running) {
      schedule();
    }
  };
  const schedule = () => {
    if (!frame && !stopped) {
      frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(tick) : (setTimeout(tick, 16) as unknown as number);
    }
  };

  if (options.settle) {
    engine.step(Infinity, INLINE_SETTLE_TICKS);
    emit(false);
  } else {
    schedule();
  }
  return {
    pin: (index, x, y) => {
      engine.pin(index, x, y);
      schedule();
    },
    release: (index) => {
      engine.release(index);
      schedule();
    },
    reheat: (target) => {
      engine.reheat(target);
      schedule();
    },
    stop: () => {
      stopped = true;
      if (frame && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frame);
      }
    },
  };
}

/**
 * Runs the force-directed layout off the main thread, so the page stays responsive however many nodes there are -
 * the main thread only paints what the worker reports. Falls back to the main thread where there are no workers.
 */
export function startForce(input: EngineInput, onFrame: OnFrame, options: ForceOptions = {}): ForceHandle {
  const worker = createWorker();
  if (!worker) {
    return startInline(input, onFrame, options);
  }
  let fallback: ForceHandle | undefined;
  let stopped = false;
  const send = (request: ForceRequest) => worker.postMessage(request);

  worker.onmessage = (event: MessageEvent<ForceFrame>) => {
    if (!stopped && event.data.type === "frame") {
      onFrame(event.data.xy, event.data.running);
    }
  };
  worker.onerror = () => {
    // The worker could not be started (e.g. blocked by a policy) - carry on without it
    worker.terminate();
    if (!stopped && !fallback) {
      fallback = startInline(input, onFrame, options);
    }
  };
  send({ type: "init", input, settle: options.settle === true });

  return {
    pin: (index, x, y) => (fallback ? fallback.pin(index, x, y) : send({ type: "pin", index, x, y })),
    release: (index) => (fallback ? fallback.release(index) : send({ type: "release", index })),
    reheat: (target) => (fallback ? fallback.reheat(target) : send({ type: "reheat", target })),
    stop: () => {
      stopped = true;
      worker.terminate();
      fallback?.stop();
    },
  };
}
