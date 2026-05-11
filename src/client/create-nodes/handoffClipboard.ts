export type HandoffCopyMethod = 'async-clipboard' | 'selection-command';

export type HandoffCopyResult =
  | {
    method: HandoffCopyMethod;
    status: 'copied';
  }
  | {
    error: string;
    status: 'manual';
  };

type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

type HandoffCopyEnvironment = {
  clipboard?: ClipboardWriter | null;
  document?: Document | null;
};

const messageFromError = (error: unknown): string => (
  error instanceof Error ? error.message : String(error || 'Clipboard copy was blocked.')
);

const copyWithSelectionCommand = (
  text: string,
  documentRef: Document,
): boolean => {
  if (!documentRef.body) return false;
  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';

  documentRef.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return documentRef.execCommand('copy');
  } finally {
    textarea.remove();
  }
};

export const copyHandoffText = async (
  text: string,
  environment: HandoffCopyEnvironment = {},
): Promise<HandoffCopyResult> => {
  const clipboard = environment.clipboard ?? globalThis.navigator?.clipboard ?? null;
  const documentRef = environment.document ?? globalThis.document ?? null;
  let lastError = 'Clipboard copy was blocked.';

  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return { status: 'copied', method: 'async-clipboard' };
    } catch (error) {
      lastError = messageFromError(error);
    }
  }

  if (documentRef) {
    try {
      if (copyWithSelectionCommand(text, documentRef)) {
        return { status: 'copied', method: 'selection-command' };
      }
      lastError = 'Clipboard copy was blocked by the browser.';
    } catch (error) {
      lastError = messageFromError(error);
    }
  }

  return { status: 'manual', error: lastError };
};
