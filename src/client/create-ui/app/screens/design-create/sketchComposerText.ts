export const TEXT_RENDER_LINE_HEIGHT = 1;
export const TEXT_DRAFT_LINE_HEIGHT = 1;
export const SKETCH_TEXT_FONT_FAMILY = '"Google Sans", Arial, sans-serif';

export const buildTextFont = (fontSize: number): string => `${fontSize}px ${SKETCH_TEXT_FONT_FAMILY}`;

export const normalizeSketchText = (value: string): string => value.replace(/\r\n?/g, '\n');

export const getTextLines = (text: string): string[] => normalizeSketchText(text).split('\n');

export const trimSketchText = (value: string): string => normalizeSketchText(value).trim();

const measureCanvasText = (
  context: Pick<CanvasRenderingContext2D, 'measureText'> | null,
  value: string,
  fontSize: number,
): number => {
  if (context) {
    return context.measureText(value || ' ').width;
  }
  return Math.max(fontSize * 0.6, value.length * fontSize * 0.62);
};

const splitOversizedToken = (
  args: {
    context: Pick<CanvasRenderingContext2D, 'measureText'> | null;
    token: string;
    maxWidth: number;
    fontSize: number;
  },
): string[] => {
  const chunks: string[] = [];
  let current = '';

  for (const character of args.token) {
    const next = `${current}${character}`;
    if (current && measureCanvasText(args.context, next, args.fontSize) > args.maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }
  return chunks.length > 0 ? chunks : [args.token];
};

export const wrapSketchTextLines = (
  args: {
    context: Pick<CanvasRenderingContext2D, 'measureText'> | null;
    text: string;
    fontSize: number;
    maxWidth: number;
  },
): string[] => {
  const sourceLines = getTextLines(args.text);
  if (!Number.isFinite(args.maxWidth) || args.maxWidth <= args.fontSize * 0.6) {
    return sourceLines;
  }

  const wrappedLines: string[] = [];
  for (const sourceLine of sourceLines) {
    if (!sourceLine) {
      wrappedLines.push('');
      continue;
    }

    let current = '';
    const tokens = sourceLine.match(/\S+\s*/g) ?? [sourceLine];

    for (const token of tokens) {
      const next = `${current}${token}`;
      if (measureCanvasText(args.context, next, args.fontSize) <= args.maxWidth) {
        current = next;
        continue;
      }

      if (current) {
        wrappedLines.push(current.trimEnd());
      }
      const oversizedChunks = splitOversizedToken({
        context: args.context,
        token: token.trimStart(),
        maxWidth: args.maxWidth,
        fontSize: args.fontSize,
      });
      current = oversizedChunks.pop() ?? '';
      wrappedLines.push(...oversizedChunks);
    }

    wrappedLines.push(current.trimEnd());
  }

  return wrappedLines;
};
