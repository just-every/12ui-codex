import React from 'react';

const expansionButtonClassName = (
  isVisible: boolean,
  disabled?: boolean,
): string => [
  'flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[24px] font-light leading-none text-black shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition duration-150 focus:scale-105 focus:border-black/24 focus:bg-white focus:outline-none',
  disabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer hover:scale-105 hover:border-black/24 hover:bg-white',
  isVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
].join(' ');

export function DesignImageExpansionControls(args: {
  canExpand?: boolean;
  className?: string;
  disabled?: boolean;
  isBusy?: boolean;
  isVisible?: boolean;
  onExtendImage: (nextPagePrompt: string | null) => Promise<void>;
}) {
  const [isPromptOpen, setPromptOpen] = React.useState(false);
  const [nextPagePrompt, setNextPagePrompt] = React.useState('');
  const [localError, setLocalError] = React.useState<string | null>(null);
  const canExpand = args.canExpand !== false;
  const isDisabled = Boolean(args.disabled || args.isBusy);

  React.useEffect(() => {
    if (isDisabled || !canExpand) setPromptOpen(false);
  }, [canExpand, isDisabled]);

  if (!canExpand) return null;

  const submit = async (prompt: string | null) => {
    setPromptOpen(false);
    setLocalError(null);
    try {
      await args.onExtendImage(prompt?.trim() || null);
      setNextPagePrompt('');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Image extension failed.');
    }
  };

  return (
    <div
      className={args.className ?? 'relative z-20'}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Extend image downward"
        title="Extend image downward"
        disabled={isDisabled}
        className={expansionButtonClassName(Boolean(args.isVisible || isPromptOpen || args.isBusy), isDisabled)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (isDisabled) return;
          setPromptOpen((current) => !current);
        }}
      >
        {args.isBusy ? '...' : '+'}
      </button>
      {isPromptOpen ? (
        <form
          className="absolute bottom-12 left-1/2 z-30 w-[280px] -translate-x-1/2 rounded-[8px] border border-black/12 bg-white p-3 shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(nextPagePrompt);
          }}
        >
          <textarea
            value={nextPagePrompt}
            rows={3}
            maxLength={1200}
            placeholder="What should appear next? Optional."
            className="block w-full resize-none rounded-[6px] border border-black/12 bg-white px-3 py-2 text-[13px] leading-5 text-black outline-none placeholder:text-black/35 focus:border-black/36"
            onChange={(event) => setNextPagePrompt(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setPromptOpen(false);
              }
            }}
            autoFocus
          />
          <div className="mt-2 flex items-center justify-end">
            <button type="submit" className="rounded-full bg-black px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-black/86">
              Extend
            </button>
          </div>
        </form>
      ) : null}
      {localError ? (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-20 w-[280px] -translate-x-1/2 rounded-full bg-white/94 px-3 py-1.5 text-center text-[11px] font-semibold text-[#7b2727] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
          {localError}
        </div>
      ) : null}
    </div>
  );
}
