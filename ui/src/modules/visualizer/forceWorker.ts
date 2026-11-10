/// <reference lib="webworker" />
import { EngineInput, ForceEngine } from "./forceEngine";

/** What the main thread tells the worker (see forceClient). */
export type ForceRequest =
  | { type: "init"; input: EngineInput; settle: boolean }
  | { type: "pin"; index: number; x: number; y: number }
  | { type: "release"; index: number }
  | { type: "reheat"; target: number };

/** What the worker answers: the positions (x, y, x, y, ...) and whether it is still going. */
export interface ForceFrame {
  type: "frame";
  xy: Float32Array;
  running: boolean;
}

const FRAME_BUDGET_MS = 12;
const MAX_SETTLE_TICKS = 300;

const scope = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<ForceRequest>) => void) | null;
};

let engine: ForceEngine | undefined;
let scheduled = false;

function post(running: boolean): void {
  if (!engine) {
    return;
  }
  const xy = new Float32Array(engine.size * 2);
  engine.write(xy);
  const frame: ForceFrame = { type: "frame", xy, running };
  scope.postMessage(frame, [xy.buffer]);
}

function pump(): void {
  scheduled = false;
  if (!engine) {
    return;
  }
  const running = engine.step(FRAME_BUDGET_MS);
  post(running);
  if (running) {
    schedule();
  }
}

function schedule(): void {
  if (!scheduled) {
    scheduled = true;
    setTimeout(pump, 0);
  }
}

scope.onmessage = (event) => {
  const request = event.data;
  switch (request.type) {
    case "init":
      engine = new ForceEngine(request.input);
      if (request.settle) {
        // Reduced motion: the result at once, no animation
        engine.step(Infinity, MAX_SETTLE_TICKS);
        post(false);
      } else {
        schedule();
      }
      break;
    case "pin":
      engine?.pin(request.index, request.x, request.y);
      schedule();
      break;
    case "release":
      engine?.release(request.index);
      schedule();
      break;
    case "reheat":
      engine?.reheat(request.target);
      schedule();
      break;
  }
};
