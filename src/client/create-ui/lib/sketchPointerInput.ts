export type SketchPointerMetadata = {
  altitudeAngle?: number;
  azimuthAngle?: number;
  button?: number;
  buttons?: number;
  pointerType?: string;
  pressure?: number;
  tangentialPressure?: number;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
};

export type SketchPointerSample = SketchPointerMetadata & {
  clientX: number;
  clientY: number;
};

type PointerEventSource = SketchPointerSample & {
  nativeEvent?: PointerEvent;
};

const PRESSURE_WIDTH_MIN_FACTOR = 0.35;
const PRESSURE_WIDTH_MAX_FACTOR = 1.45;

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const optionalFinite = (value: unknown): number | undefined => (
  isFiniteNumber(value) ? value : undefined
);

export const readSketchPointerMetadata = (
  event: SketchPointerMetadata,
): SketchPointerMetadata => {
  const pointerType = typeof event.pointerType === 'string' && event.pointerType.length > 0
    ? event.pointerType
    : undefined;
  if (pointerType !== 'pen') return {};

  const pressure = isFiniteNumber(event.pressure)
    ? clamp(event.pressure, 0, 1)
    : undefined;

  const metadata: SketchPointerMetadata = {
    pointerType,
  };
  if (pressure !== undefined) metadata.pressure = pressure;
  const altitudeAngle = optionalFinite(event.altitudeAngle);
  const azimuthAngle = optionalFinite(event.azimuthAngle);
  const button = optionalFinite(event.button);
  const buttons = optionalFinite(event.buttons);
  const tangentialPressure = optionalFinite(event.tangentialPressure);
  const tiltX = optionalFinite(event.tiltX);
  const tiltY = optionalFinite(event.tiltY);
  const twist = optionalFinite(event.twist);
  if (altitudeAngle !== undefined) metadata.altitudeAngle = altitudeAngle;
  if (azimuthAngle !== undefined) metadata.azimuthAngle = azimuthAngle;
  if (button !== undefined) metadata.button = button;
  if (buttons !== undefined) metadata.buttons = buttons;
  if (tangentialPressure !== undefined) metadata.tangentialPressure = tangentialPressure;
  if (tiltX !== undefined) metadata.tiltX = tiltX;
  if (tiltY !== undefined) metadata.tiltY = tiltY;
  if (twist !== undefined) metadata.twist = twist;
  return metadata;
};

export const readSketchPointerSamples = (
  event: PointerEventSource,
): SketchPointerSample[] => {
  const coalescedEvents = event.nativeEvent?.getCoalescedEvents?.() ?? [];
  const sourceEvents = coalescedEvents.length > 0 ? coalescedEvents : [event];
  return sourceEvents.map((sample) => ({
    clientX: sample.clientX,
    clientY: sample.clientY,
    ...readSketchPointerMetadata(sample),
  }));
};

export const resolveSketchPressureWidth = (
  baseWidth: number,
  pressure?: number,
): number => {
  if (!isFiniteNumber(baseWidth) || baseWidth <= 0) return 0;
  if (!isFiniteNumber(pressure)) return baseWidth;
  const factor = PRESSURE_WIDTH_MIN_FACTOR + (clamp(pressure, 0, 1) * (
    PRESSURE_WIDTH_MAX_FACTOR - PRESSURE_WIDTH_MIN_FACTOR
  ));
  return baseWidth * factor;
};
