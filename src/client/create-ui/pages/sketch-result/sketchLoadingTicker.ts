type SketchLoadingFrameCallback = (now: number) => void;

const FRAME_INTERVAL_MS = 1000 / 30;

const subscribers = new Set<SketchLoadingFrameCallback>();

let rafId: number | null = null;
let previousFrameMs = 0;

const tick = (now: number) => {
  if (now - previousFrameMs >= FRAME_INTERVAL_MS) {
    previousFrameMs = now;
    subscribers.forEach((callback) => callback(now));
  }

  if (subscribers.size > 0) {
    rafId = window.requestAnimationFrame(tick);
  } else {
    rafId = null;
    previousFrameMs = 0;
  }
};

export const subscribeSketchLoadingFrame = (
  callback: SketchLoadingFrameCallback,
): (() => void) => {
  subscribers.add(callback);

  if (rafId === null) {
    previousFrameMs = 0;
    rafId = window.requestAnimationFrame(tick);
  }

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
      previousFrameMs = 0;
    }
  };
};
