const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const lerp = (start: number, end: number, progress: number): number => (
  start + ((end - start) * progress)
);

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - (2 * progress));
};

const fract = (value: number): number => (
  value - Math.floor(value)
);

const easeInOutCubic = (value: number): number => (
  value < 0.5
    ? (4 * value * value * value)
    : (1 - (((-2 * value) + 2) ** 3) / 2)
);

const easeOutCubic = (value: number): number => {
  const inverse = 1 - clamp(value, 0, 1);
  return 1 - (inverse * inverse * inverse);
};

const MOVING_WASH_SOURCES = [
  {
    startX: -0.18,
    startY: 0.1,
    endX: 0.56,
    endY: 0.32,
    delay: 0,
    spread: 0.56,
    phase: 0.4,
  },
  {
    startX: 0.28,
    startY: -0.2,
    endX: 0.86,
    endY: 0.48,
    delay: 0.08,
    spread: 0.48,
    phase: 1.7,
  },
  {
    startX: 1.08,
    startY: 0.2,
    endX: 0.56,
    endY: 0.82,
    delay: 0.18,
    spread: 0.52,
    phase: 3.1,
  },
  {
    startX: 0.06,
    startY: 1.08,
    endX: 0.72,
    endY: 0.58,
    delay: 0.28,
    spread: 0.44,
    phase: 4.8,
  },
] as const;

const FINAL_PASS_ORIGINS = [
  { x: -0.18, y: 0.18, phase: 0.6 },
  { x: 1.04, y: 0.34, phase: 2.1 },
  { x: 0.26, y: 1.06, phase: 4.1 },
] as const;

const sampleMovingWashField = (flowX: number, flowY: number, progress: number) => {
  let field = -1;
  let wake = 0;
  let phaseAccumulator = 0;

  for (const source of MOVING_WASH_SOURCES) {
    const local = clamp((progress - source.delay) / Math.max(0.001, 1 - source.delay), 0, 1);
    const eased = easeOutCubic(smoothstep(0.04, 0.58, local));
    const headX = lerp(source.startX, source.endX, eased);
    const headY = lerp(source.startY, source.endY, eased);
    const travelX = source.endX - source.startX;
    const travelY = source.endY - source.startY;
    const travelLength = Math.max(0.001, Math.hypot(travelX, travelY));
    const unitX = travelX / travelLength;
    const unitY = travelY / travelLength;
    const radius = lerp(-0.12, source.spread, eased);
    const dx = flowX - headX;
    const dy = flowY - headY;
    const along = (dx * unitX) + (dy * unitY);
    const lateral = Math.abs((-dx * unitY) + (dy * unitX));
    const trailDistance = Math.hypot(Math.max(0, along) * 1.72, lateral * 2.34);
    const distance = Math.min(Math.hypot(dx, dy), trailDistance);
    const influence = radius - distance;
    const localWake = smoothstep(-0.06, 0.16, influence);
    field = Math.max(field, influence);
    wake = Math.max(wake, localWake);
    phaseAccumulator += localWake * ((local * 0.24) + (source.phase * 0.11));
  }

  return {
    field,
    wake,
    phase: fract(phaseAccumulator),
  };
};

export function resolveSloshState(args: {
  screenX: number;
  screenY: number;
  width: number;
  height: number;
  sloshProgress: number;
}): {
  visible: number;
  colorPhase: number;
  sizeLinger: number;
} {
  const nx = args.screenX / Math.max(1, args.width);
  const ny = args.screenY / Math.max(1, args.height);
  const driftStrength = 1 - smoothstep(0.14, 0.58, args.sloshProgress);

  const currentX = (
    (Math.sin((ny * 5.8) + (args.sloshProgress * 5.4)) * 0.04)
    + (Math.cos((nx * 4.4) - (ny * 3.2) + (args.sloshProgress * 4.2)) * 0.026)
  ) * driftStrength;
  const currentY = (
    (Math.cos((nx * 5.1) - (args.sloshProgress * 5.1)) * 0.034)
    + (Math.sin((ny * 4.5) + (nx * 2.6) + (args.sloshProgress * 4.7)) * 0.024)
  ) * driftStrength;

  const flowX = nx + currentX;
  const flowY = ny + currentY;
  const movingWash = sampleMovingWashField(flowX, flowY, args.sloshProgress);

  const distortedDiagonal = (
    (flowX * 0.58)
    + (flowY * 0.45)
    + (Math.sin((flowY * 6.1) + (args.sloshProgress * 4.2)) * 0.04)
    + (Math.cos((flowX * 5) - (flowY * 3.2) + (args.sloshProgress * 3.7)) * 0.03)
    - (movingWash.wake * 0.06)
  );
  const arrivalFront = lerp(-0.22, 1.32, easeInOutCubic(args.sloshProgress));
  const arrival = clamp((arrivalFront - distortedDiagonal) / 0.22, 0, 1);
  const arrivalVisibility = smoothstep(0.02, 0.18, arrival);

  const localArrivalTime = clamp((distortedDiagonal + 0.18) / 1.46, 0, 1);
  const sinceArrival = clamp((args.sloshProgress - localArrivalTime) / 0.34, 0, 1);
  const lifecycle = smoothstep(0.02, 0.14, sinceArrival) * (1 - smoothstep(0.66, 0.98, sinceArrival));

  const phaseSeed = fract(
    (flowX * 0.31)
    + (flowY * 0.27)
    + (movingWash.phase * 0.42)
    + (Math.sin((flowX * 8.7) + (flowY * 5.4)) * 0.08)
    + (Math.cos((flowY * 7.1) - (flowX * 4.2)) * 0.06)
  );
  const wakePulse = smoothstep(0.04, 0.22, sinceArrival) * (1 - smoothstep(0.44, 0.84, sinceArrival));
  const leadingSplash = smoothstep(0.04, 0.2, arrival) * (1 - smoothstep(0.26, 0.46, arrival));
  const sourcePresence = smoothstep(-0.02, 0.18, movingWash.field);
  const transientVisibility = clamp(
    Math.max(
      leadingSplash * (0.32 + (sourcePresence * 0.48)),
      arrivalVisibility * lifecycle * (0.22 + (wakePulse * 0.6)) * (0.42 + (sourcePresence * 0.86)),
      sourcePresence * lifecycle * (0.2 + (wakePulse * 0.44)),
    ),
    0,
    1,
  );
  const colorPhase = fract(
    (args.sloshProgress * 0.18)
    + (flowX * 0.22)
    + (flowY * 0.18)
    + (phaseSeed * 0.28)
    + (movingWash.phase * 0.24),
  );
  const sizeLinger = clamp(0.5 + (wakePulse * 0.28) + (sourcePresence * 0.18), 0.18, 0.96);

  return {
    visible: transientVisibility,
    colorPhase,
    sizeLinger,
  };
}

export function resolveFinalPassProgress(args: {
  screenX: number;
  screenY: number;
  width: number;
  height: number;
  finalPassProgress: number;
}): number {
  const nx = args.screenX / Math.max(1, args.width);
  const ny = args.screenY / Math.max(1, args.height);

  let field = -1;
  for (const origin of FINAL_PASS_ORIGINS) {
    const radius = lerp(-0.14, 1.18, easeInOutCubic(args.finalPassProgress));
    const distance = Math.hypot(nx - origin.x, ny - origin.y);
    const ripple = Math.sin((distance * 16.5) - (args.finalPassProgress * 6.2) + origin.phase) * 0.03;
    field = Math.max(field, radius - distance + ripple);
  }

  return clamp((field + 0.08) / 0.26, 0, 1);
}
