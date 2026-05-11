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

const lerp = (start: number, end: number, progress: number): number => (
  start + ((end - start) * progress)
);

const easeInOutCubic = (value: number): number => {
  const clamped = clamp(value, 0, 1);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - (((-2 * clamped) + 2) ** 3) / 2;
};

const hashSeed = (seedKey: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seedKey.length; index += 1) {
    hash ^= seedKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (seed: number) => {
  let state = seed || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967295;
  };
};

type LoadingSource = {
  angle: number;
  distance: number;
  radius: number;
  orbitSpeed: number;
  phase: number;
  pulseSpeed: number;
  weight: number;
};

type LoadingFrameSource = {
  headX: number;
  headY: number;
  radius: number;
  weight: number;
  phase: number;
  phaseMix: number;
};

export type SketchDraftLoadingFlow = {
  basePhase: number;
  colorOffset: number;
  turbulence: number;
  centerX: number;
  centerY: number;
  driftX: number;
  driftY: number;
  driftSpeed: number;
  sources: LoadingSource[];
};

export type SketchDraftLoadingFrame = {
  width: number;
  height: number;
  elapsedMs: number;
  t: number;
  motionTime: number;
  lobeTime: number;
  burstDamping: number;
  fieldDamping: number;
  turbulence: number;
  basePhase: number;
  colorOffset: number;
  sources: LoadingFrameSource[];
};

export type SketchDraftLoadingDartState = {
  activity: number;
  offsetX: number;
  offsetY: number;
  unitX: number;
  unitY: number;
};

const DART_CYCLE_SECONDS = 5.35;
const DART_START = 0.16;
const DART_END = 0.38;
const DART_SETTLE_END = 0.66;

const sampleDartWaypoint = (
  flow: SketchDraftLoadingFlow,
  cycleIndex: number,
): { x: number; y: number } => {
  const turn = flow.basePhase
    + (cycleIndex * 0.92)
    + (Math.sin((cycleIndex * 1.713) + flow.basePhase) * 0.24);
  const reach = 0.11
    + (Math.sin((cycleIndex * 1.37) + (flow.basePhase * 0.71)) * 0.02)
    + (Math.cos((cycleIndex * 0.743) + (flow.basePhase * 1.39)) * 0.012);

  return {
    x: Math.cos(turn) * reach,
    y: Math.sin(turn) * reach,
  };
};

export const resolveSketchDraftLoadingDartState = (args: {
  elapsedMs: number;
  flow: SketchDraftLoadingFlow;
}): SketchDraftLoadingDartState => {
  const t = args.elapsedMs / 1000;
  const cyclePosition = (t / DART_CYCLE_SECONDS) + (args.flow.colorOffset * 0.58);
  const cycleIndex = Math.floor(cyclePosition);
  const cyclePhase = fract(cyclePosition);
  const from = sampleDartWaypoint(args.flow, cycleIndex);
  const to = sampleDartWaypoint(args.flow, cycleIndex + 1);
  const travelX = to.x - from.x;
  const travelY = to.y - from.y;
  const travelLength = Math.max(0.001, Math.hypot(travelX, travelY));
  const launchProgress = easeInOutCubic((cyclePhase - DART_START) / (DART_END - DART_START));
  const settle = 1 - smoothstep(DART_END, DART_SETTLE_END, cyclePhase);
  const activity = smoothstep(DART_START, DART_END, cyclePhase) * settle;

  return {
    activity,
    offsetX: lerp(from.x, to.x, launchProgress),
    offsetY: lerp(from.y, to.y, launchProgress),
    unitX: travelX / travelLength,
    unitY: travelY / travelLength,
  };
};

export const buildSketchDraftLoadingFlow = (seedKey: string): SketchDraftLoadingFlow => {
  const random = createRandom(hashSeed(seedKey));
  const sourceCount = 6;
  const sources = Array.from({ length: sourceCount }, (_, index) => {
    const isCore = index === 0;

    return {
      angle: isCore ? 0 : ((Math.PI * 2 * index) / (sourceCount - 1)) + ((random() - 0.5) * 0.7),
      distance: isCore ? 0 : 0.07 + (random() * 0.14),
      radius: isCore ? 0.34 + (random() * 0.04) : 0.2 + (random() * 0.12),
      orbitSpeed: 0.34 + (random() * 0.32),
      phase: random() * Math.PI * 2,
      pulseSpeed: 0.72 + (random() * 0.5),
      weight: isCore ? 1 : 0.58 + (random() * 0.28),
    };
  });

  return {
    basePhase: random() * Math.PI * 2,
    colorOffset: random(),
    turbulence: 0.9 + (random() * 0.78),
    centerX: 0.46 + (random() * 0.08),
    centerY: 0.46 + (random() * 0.08),
    driftX: 0.2 + (random() * 0.14),
    driftY: 0.18 + (random() * 0.14),
    driftSpeed: 0.28 + (random() * 0.18),
    sources,
  };
};

export const buildSketchDraftLoadingFrame = (args: {
  width: number;
  height: number;
  elapsedMs: number;
  flow: SketchDraftLoadingFlow;
}): SketchDraftLoadingFrame => {
  const t = args.elapsedMs / 1000;
  const motionTime = (
    t
    + (Math.sin((t * 0.62) + args.flow.basePhase) * 0.42)
    + (Math.sin((t * 0.19) + (args.flow.basePhase * 2.3)) * 0.74)
  );
  const dart = resolveSketchDraftLoadingDartState({
    elapsedMs: args.elapsedMs,
    flow: args.flow,
  });
  const speedBurst = dart.activity;
  const lobeTime = motionTime * (1 + (speedBurst * 0.015));
  const burstDamping = 1 - (speedBurst * 0.86);
  const orbitDamping = 1 - (speedBurst * 0.72);
  const fieldDamping = 1 - (speedBurst * 0.62);

  const pathTime = motionTime * args.flow.driftSpeed;
  const sampleCenterX = (time: number) => (
    args.flow.centerX
      + (Math.sin((time * 1.18) + args.flow.basePhase) * args.flow.driftX)
      + (Math.sin((time * 0.42) + (args.flow.basePhase * 1.8)) * 0.12)
      + (Math.cos((time * 0.23) + (args.flow.basePhase * 0.44)) * 0.08)
  );
  const sampleCenterY = (time: number) => (
    args.flow.centerY
      + (Math.cos((time * 1.04) + (args.flow.basePhase * 0.74)) * args.flow.driftY)
      + (Math.sin((time * 0.36) + (args.flow.basePhase * 1.45)) * 0.11)
      + (Math.cos((time * 0.27) + (args.flow.basePhase * 2.1)) * 0.07)
  );
  const centerX = sampleCenterX(pathTime) + dart.offsetX + (dart.unitX * speedBurst * 0.025);
  const centerY = sampleCenterY(pathTime) + dart.offsetY + (dart.unitY * speedBurst * 0.025);

  const sources = args.flow.sources.map((source): LoadingFrameSource => {
    const orbit = source.angle
      + ((
        (Math.sin((lobeTime * source.orbitSpeed) + source.phase) * 0.92)
        + (Math.cos((motionTime * source.orbitSpeed * 0.82) + (source.phase * 0.7)) * 0.46)
        + (Math.sin((lobeTime * source.orbitSpeed * 2.04) + (source.phase * 1.21)) * 0.22 * burstDamping)
      ) * orbitDamping);
    const lobeDistance = source.distance * (1 - (speedBurst * 0.2)) * (
      0.8
      + (Math.sin((lobeTime * source.pulseSpeed) + source.phase) * 0.22)
      + (Math.cos((motionTime * source.pulseSpeed * 1.55) + (source.phase * 0.56)) * 0.14)
    );
    const wobbleX = Math.sin((lobeTime * source.pulseSpeed * 1.52) + (source.phase * 1.6)) * source.radius * 0.12 * burstDamping;
    const wobbleY = Math.cos((motionTime * source.pulseSpeed * 1.33) + (source.phase * 1.27)) * source.radius * 0.12 * burstDamping;
    const trailPull = speedBurst * source.radius * (source.distance === 0 ? 0.16 : 0.38);
    const lateralPull = speedBurst * Math.sin(source.phase + source.angle) * source.radius * 0.09;
    const radius = source.radius * (
      0.94
      + (Math.sin((lobeTime * source.pulseSpeed) + source.phase) * 0.1)
      + (Math.cos((motionTime * source.pulseSpeed * 1.44) + (source.phase * 0.42)) * 0.06)
    );

    return {
      headX: centerX
        + (Math.cos(orbit) * lobeDistance)
        + wobbleX
        - (dart.unitX * trailPull)
        - (dart.unitY * lateralPull),
      headY: centerY
        + (Math.sin(orbit) * lobeDistance)
        + wobbleY
        - (dart.unitY * trailPull)
        + (dart.unitX * lateralPull),
      radius,
      weight: source.weight,
      phase: source.phase,
      phaseMix: 0.1 + (source.phase / (Math.PI * 2)) + (Math.sin((t * source.pulseSpeed) + source.phase) * 0.08),
    };
  });

  return {
    width: args.width,
    height: args.height,
    elapsedMs: args.elapsedMs,
    t,
    motionTime,
    lobeTime,
    burstDamping,
    fieldDamping,
    turbulence: args.flow.turbulence,
    basePhase: args.flow.basePhase,
    colorOffset: args.flow.colorOffset,
    sources,
  };
};

export const resolveSketchDraftLoadingStateFromFrame = (args: {
  screenX: number;
  screenY: number;
  frame: SketchDraftLoadingFrame;
}): {
  visible: number;
  colorPhase: number;
  sizeBias: number;
} => {
  const nx = args.screenX / Math.max(1, args.frame.width);
  const ny = args.screenY / Math.max(1, args.frame.height);

  let emptyField = 1;
  let sizeBias = 0;
  let phaseMix = args.frame.colorOffset * 0.35;

  const driftX = (
    Math.sin((ny * 4.8) + (args.frame.lobeTime * 1.95) + args.frame.basePhase) * 0.044
    + Math.cos((nx * 3.1) - (args.frame.lobeTime * 1.48) + (args.frame.basePhase * 0.6)) * 0.027
  ) * args.frame.turbulence * args.frame.fieldDamping;
  const driftY = (
    Math.cos((nx * 4.2) - (args.frame.lobeTime * 1.78) + (args.frame.basePhase * 0.8)) * 0.038
    + Math.sin((ny * 3.6) + (args.frame.lobeTime * 1.42) + (args.frame.basePhase * 0.5)) * 0.025
  ) * args.frame.turbulence * args.frame.fieldDamping;

  const flowX = nx + driftX;
  const flowY = ny + driftY;

  for (const source of args.frame.sources) {
    const distance = Math.hypot(flowX - source.headX, flowY - source.headY);
    const edgeRipple = ((
      Math.sin((distance * 13.5) - (args.frame.lobeTime * 2.45) + source.phase) * 0.028
    ) + (
      Math.cos((distance * 8.4) + (args.frame.motionTime * 1.8) + (source.phase * 0.67)) * 0.016
    )) * args.frame.burstDamping;
    const influence = source.radius - distance + edgeRipple;
    const localVisible = smoothstep(-0.16, 0.2, influence) * source.weight;

    emptyField *= 1 - clamp(localVisible, 0, 0.92);
    sizeBias = Math.max(sizeBias, localVisible * (0.62 + (smoothstep(0.1, 0.86, source.radius) * 0.3)));
    phaseMix += localVisible * source.phaseMix;
  }

  const visible = clamp(1 - emptyField, 0, 1);
  const ambient = smoothstep(0.42, 1, 0.5 + (Math.sin((flowX * 5.5) + (flowY * 4.2) + (args.frame.t * 1.4)) * 0.5));
  const finalVisible = clamp(Math.max(visible, ambient * 0.12), 0, 1);

  return {
    visible: finalVisible,
    colorPhase: fract(phaseMix + (flowX * 0.18) + (flowY * 0.12) + (args.frame.t * 0.04)),
    sizeBias,
  };
};

export const resolveSketchDraftLoadingState = (args: {
  screenX: number;
  screenY: number;
  width: number;
  height: number;
  elapsedMs: number;
  flow: SketchDraftLoadingFlow;
}): {
  visible: number;
  colorPhase: number;
  sizeBias: number;
} => (
  resolveSketchDraftLoadingStateFromFrame({
    screenX: args.screenX,
    screenY: args.screenY,
    frame: buildSketchDraftLoadingFrame({
      width: args.width,
      height: args.height,
      elapsedMs: args.elapsedMs,
      flow: args.flow,
    }),
  })
);
