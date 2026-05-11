import { resolveSketchPressureWidth, type SketchPointerMetadata } from '../create-ui/lib/sketchPointerInput';

export type DesignImageMaskPoint = {
  x: number;
  y: number;
} & SketchPointerMetadata;

export type DesignImageMaskStroke = {
  id: string;
  points: DesignImageMaskPoint[];
  width: number;
};

export type DesignImageMaskFrame = {
  displayHeight: number;
  displayWidth: number;
  naturalHeight: number;
  naturalWidth: number;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;

export const resolveDesignImageMaskPointWidth = (
  stroke: DesignImageMaskStroke,
  point: DesignImageMaskPoint,
): number => resolveSketchPressureWidth(stroke.width, point.pressure);

const drawCircle = (
  alpha: Uint8ClampedArray,
  args: {
    cx: number;
    cy: number;
    radius: number;
    width: number;
    height: number;
  },
) => {
  const radius = Math.max(0.5, args.radius);
  const radiusSq = radius * radius;
  for (let y = Math.max(0, Math.floor(args.cy - radius)); y <= Math.min(args.height - 1, Math.ceil(args.cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(args.cx - radius)); x <= Math.min(args.width - 1, Math.ceil(args.cx + radius)); x += 1) {
      const dx = x + 0.5 - args.cx;
      const dy = y + 0.5 - args.cy;
      if ((dx * dx) + (dy * dy) <= radiusSq) alpha[(y * args.width) + x] = 0;
    }
  }
};

export const createDesignImageEditMaskDataUrl = (
  strokes: readonly DesignImageMaskStroke[],
  frame: DesignImageMaskFrame,
): string => {
  if (!isPositive(frame.displayWidth) || !isPositive(frame.displayHeight) || !isPositive(frame.naturalWidth) || !isPositive(frame.naturalHeight)) {
    throw new Error('Image edit mask requires valid display and natural dimensions.');
  }

  const width = Math.max(1, Math.round(frame.naturalWidth));
  const height = Math.max(1, Math.round(frame.naturalHeight));
  const scaleX = width / frame.displayWidth;
  const scaleY = height / frame.displayHeight;
  const alpha = new Uint8ClampedArray(width * height);
  alpha.fill(255);

  for (const stroke of strokes) {
    const points = stroke.points
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .map((point) => ({
        ...point,
        x: clamp(point.x * scaleX, 0, width - 1),
        y: clamp(point.y * scaleY, 0, height - 1),
      }));
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]!;
      const radius = Math.max(1, (resolveDesignImageMaskPointWidth(stroke, point) * Math.min(scaleX, scaleY)) / 2);
      drawCircle(alpha, { cx: point.x, cy: point.y, radius, width, height });
      const previous = points[index - 1];
      if (!previous) continue;
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.5)));
      for (let step = 1; step < steps; step += 1) {
        const ratio = step / steps;
        drawCircle(alpha, {
          cx: previous.x + ((point.x - previous.x) * ratio),
          cy: previous.y + ((point.y - previous.y) * ratio),
          radius,
          width,
          height,
        });
      }
    }
  }

  if (!alpha.some((value) => value === 0)) {
    throw new Error('Draw over the image before submitting an edit.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create image edit mask.');
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    rgba[offset] = 255;
    rgba[offset + 1] = 255;
    rgba[offset + 2] = 255;
    rgba[offset + 3] = alpha[index] ?? 255;
  }
  context.putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas.toDataURL('image/png');
};
