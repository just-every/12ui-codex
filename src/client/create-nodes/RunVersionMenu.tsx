import React from 'react';

const ArrowIcon = ({ direction }: { direction: 'previous' | 'next' }) => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      d={direction === 'previous' ? 'M14.5 6.5 9 12l5.5 5.5' : 'M9.5 6.5 15 12l-5.5 5.5'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
    />
  </svg>
);

const controlClassName = [
  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-black',
  'shadow-[0_10px_20px_rgba(0,0,0,0.08)] outline-none transition-colors',
  'hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/16',
  'disabled:cursor-not-allowed disabled:bg-white disabled:text-black/20 disabled:shadow-none',
].join(' ');

export function RunVersionMenu(args: {
  label: string;
  runIds: string[];
  activeRunId: string | null;
  onChange: (runId: string) => void;
}) {
  const uniqueRunIds = React.useMemo(() => Array.from(new Set(args.runIds)), [args.runIds]);
  if (uniqueRunIds.length < 2 || !args.activeRunId) return null;

  const activeIndex = uniqueRunIds.indexOf(args.activeRunId);
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : uniqueRunIds.length - 1;
  const previousRunId = safeActiveIndex > 0 ? uniqueRunIds[safeActiveIndex - 1] : null;
  const nextRunId = safeActiveIndex < uniqueRunIds.length - 1 ? uniqueRunIds[safeActiveIndex + 1] : null;

  return (
    <div className="flex items-center justify-center gap-2" aria-label={`${args.label} history`}>
      <button
        type="button"
        className={controlClassName}
        aria-label={`Previous ${args.label.toLowerCase()}`}
        disabled={!previousRunId}
        onClick={() => {
          if (previousRunId) args.onChange(previousRunId);
        }}
      >
        <ArrowIcon direction="previous" />
      </button>
      <button
        type="button"
        className={controlClassName}
        aria-label={`Next ${args.label.toLowerCase()}`}
        disabled={!nextRunId}
        onClick={() => {
          if (nextRunId) args.onChange(nextRunId);
        }}
      >
        <ArrowIcon direction="next" />
      </button>
    </div>
  );
}
