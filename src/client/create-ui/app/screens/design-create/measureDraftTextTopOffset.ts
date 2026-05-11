const topOffsetCache = new Map<string, number>();

export const measureDraftTextTopOffset = (args: {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}): number => {
  const key = `${args.fontFamily}|${args.fontSize}|${args.lineHeight}`;
  const cached = topOffsetCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  if (typeof document === 'undefined') {
    return args.fontSize * 0.8;
  }

  const container = document.createElement('div');
  const sample = document.createElement('span');
  const baselineMarker = document.createElement('span');

  container.style.position = 'absolute';
  container.style.left = '-99999px';
  container.style.top = '-99999px';
  container.style.visibility = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.whiteSpace = 'pre';
  container.style.margin = '0';
  container.style.padding = '0';

  sample.textContent = 'Hg';
  sample.style.display = 'inline-block';
  sample.style.fontFamily = args.fontFamily;
  sample.style.fontSize = `${args.fontSize}px`;
  sample.style.lineHeight = String(args.lineHeight);
  sample.style.margin = '0';
  sample.style.padding = '0';

  baselineMarker.style.display = 'inline-block';
  baselineMarker.style.width = '0';
  baselineMarker.style.height = '0';
  baselineMarker.style.verticalAlign = 'baseline';

  container.append(sample, baselineMarker);
  document.body.appendChild(container);

  const sampleRect = sample.getBoundingClientRect();
  const baselineRect = baselineMarker.getBoundingClientRect();
  container.remove();

  const topOffset = Math.max(0, baselineRect.top - sampleRect.top);
  const resolved = topOffset > 0 ? topOffset : args.fontSize * 0.8;
  topOffsetCache.set(key, resolved);
  return resolved;
};
