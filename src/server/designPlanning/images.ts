import type { DesignPlanningImage, DesignPlanningRequest } from './types.js';

export const buildPlanningImages = (request: DesignPlanningRequest): DesignPlanningImage[] => [
  ...(request.sketchDataUrl ? [{ label: 'sketch', dataUrl: request.sketchDataUrl }] : []),
  ...request.referenceDataUrls.map((dataUrl, index) => ({
    label: `reference asset ${index + 1}`,
    dataUrl,
  })),
];

export const describePlanningImages = (images: DesignPlanningImage[]): string => (
  images.length > 0
    ? `Attached visual context: ${images.map((image) => image.label).join(', ')}.`
    : 'No visual context was attached.'
);

export const planningImageContent = (images: DesignPlanningImage[]) => (
  images.map((image) => ({
    type: 'input_image' as const,
    image_url: image.dataUrl,
    detail: 'high' as const,
  }))
);
