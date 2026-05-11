import type { SketchDraftLoadingFrame } from './sketchDraftLoadingFlow';

type SketchDraftLoadingDotState = {
  visible: number;
  colorPhase: number;
  sizeBias: number;
};

export type SketchDraftLoadingExpansionState = SketchDraftLoadingDotState & {
  offsetY: number;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const fract = (value: number): number => (
  value - Math.floor(value)
);

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - (2 * progress));
};

export const resolveSketchDraftExpansionLoadingState = (args: {
  baseState: SketchDraftLoadingDotState;
  frame: SketchDraftLoadingFrame;
  screenX: number;
  screenY: number;
}): SketchDraftLoadingExpansionState => {
  const nx = args.screenX / Math.max(1, args.frame.width);
  const ny = args.screenY / Math.max(1, args.frame.height);
  const columnDelay = Math.sin((nx * 7.4) + args.frame.basePhase) * 0.055;
  const cycle = fract((args.frame.t * 0.115) + (args.frame.colorOffset * 0.41) + columnDelay);
  const headY = -0.12 + (cycle * 1.28);
  const signedDistanceFromHead = ny - headY;
  const wake = smoothstep(-0.025, 0.04, signedDistanceFromHead)
    * (1 - smoothstep(0.12, 0.38, signedDistanceFromHead));
  const headSpark = 1 - smoothstep(0, 0.045, Math.abs(signedDistanceFromHead));
  const sourceGlow = (1 - smoothstep(0.02, 0.25, ny))
    * smoothstep(-0.08, 0.16, headY)
    * (1 - smoothstep(0.64, 1.02, headY));
  const dripTail = smoothstep(0.02, 0.2, signedDistanceFromHead)
    * (1 - smoothstep(0.18, 0.54, signedDistanceFromHead));
  const downstreamAmbient = smoothstep(0.04, 0.42, ny)
    * (1 - smoothstep(0.82, 1.02, ny))
    * (0.1 + (0.08 * Math.sin((args.frame.t * 1.1) + (nx * 5.2) + args.frame.basePhase)));
  const expansionEnergy = clamp(Math.max(wake, headSpark * 0.74, sourceGlow * 0.72, dripTail * 0.8), 0, 1);
  const visible = clamp(Math.max(
    args.baseState.visible * (0.06 + (expansionEnergy * 0.34)),
    sourceGlow * 0.48,
    wake * 0.72,
    headSpark * 0.48,
    dripTail * 0.58,
    downstreamAmbient * 0.24,
  ), 0, 1);

  return {
    visible,
    colorPhase: fract(
      args.baseState.colorPhase
        + (ny * 0.34)
        + (expansionEnergy * 0.16)
        + (args.frame.t * 0.055),
    ),
    sizeBias: clamp(Math.max(
      args.baseState.sizeBias * 0.1,
      wake * 0.18,
      headSpark * 0.16,
      sourceGlow * 0.12,
    ), 0, 1),
    offsetY: expansionEnergy * (2.4 + (ny * 4.6)),
  };
};
