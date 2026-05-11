import { describe, expect, it, vi } from 'vitest';
import { copyHandoffText } from './handoffClipboard.js';

const fakeDocument = (copied: boolean): Document => {
  const removed: unknown[] = [];
  const textarea = {
    focus: vi.fn(),
    remove: vi.fn(() => removed.push(textarea)),
    select: vi.fn(),
    setAttribute: vi.fn(),
    setSelectionRange: vi.fn(),
    style: {},
    value: '',
  };
  return {
    body: {
      appendChild: vi.fn(),
    },
    createElement: vi.fn(() => textarea),
    execCommand: vi.fn(() => copied),
  } as unknown as Document;
};

describe('copyHandoffText', () => {
  it('uses async clipboard when available', async () => {
    const clipboard = {
      writeText: vi.fn(async () => {}),
    };

    await expect(copyHandoffText('handoff', {
      clipboard,
      document: fakeDocument(true),
    })).resolves.toEqual({
      status: 'copied',
      method: 'async-clipboard',
    });
    expect(clipboard.writeText).toHaveBeenCalledWith('handoff');
  });

  it('falls back to selection command when async clipboard is blocked', async () => {
    const documentRef = fakeDocument(true);

    await expect(copyHandoffText('handoff', {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('Write permission denied.');
        }),
      },
      document: documentRef,
    })).resolves.toEqual({
      status: 'copied',
      method: 'selection-command',
    });
    expect(documentRef.execCommand).toHaveBeenCalledWith('copy');
  });

  it('returns manual copy state when both script copy paths fail', async () => {
    await expect(copyHandoffText('handoff', {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('Write permission denied.');
        }),
      },
      document: fakeDocument(false),
    })).resolves.toEqual({
      status: 'manual',
      error: 'Clipboard copy was blocked by the browser.',
    });
  });
});
