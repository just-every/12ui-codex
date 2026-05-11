import React from 'react';

export const SKETCH_CANVAS_GESTURE_LOCK_CLASS = 'sketch-canvas-gesture-lock';

const isNativeGestureAllowedTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest([
    'textarea',
    'input',
    'select',
    'option',
    'button',
    'label',
    'a[href]',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="slider"]',
    '[role="textbox"]',
  ].join(', ')));
};

export function useSketchCanvasGestureLock() {
  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const preventNativeDocumentPan = (event: TouchEvent) => {
      if (!event.cancelable || isNativeGestureAllowedTarget(event.target)) return;
      event.preventDefault();
    };

    document.documentElement.classList.add(SKETCH_CANVAS_GESTURE_LOCK_CLASS);
    document.body?.classList.add(SKETCH_CANVAS_GESTURE_LOCK_CLASS);
    document.addEventListener('touchmove', preventNativeDocumentPan, { passive: false });

    return () => {
      document.documentElement.classList.remove(SKETCH_CANVAS_GESTURE_LOCK_CLASS);
      document.body?.classList.remove(SKETCH_CANVAS_GESTURE_LOCK_CLASS);
      document.removeEventListener('touchmove', preventNativeDocumentPan);
    };
  }, []);
}
