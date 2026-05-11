import React from 'react';
import { createPortal } from 'react-dom';

export function PagePlanDockControl(args: {
  canPlan: boolean;
  isPlanning: boolean;
  onPlanPages: (pagePrompt?: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [pagePrompt, setPagePrompt] = React.useState('');
  const trimmedPrompt = pagePrompt.trim();

  const submitPlan = React.useCallback(() => {
    if (!args.canPlan || args.isPlanning) return;
    args.onPlanPages(trimmedPrompt || undefined);
    setPagePrompt('');
    setIsOpen(false);
  }, [args, trimmedPrompt]);

  if (!args.canPlan && !isOpen) {
    return null;
  }

  const modal = isOpen && typeof document !== 'undefined'
    ? createPortal(
      <div
        aria-modal="true"
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/18 px-4 py-5 sm:py-8"
        role="dialog"
      >
        <div className="max-h-[calc(100dvh-40px)] w-full max-w-[560px] overflow-y-auto rounded-[22px] bg-white p-5 shadow-[0_28px_90px_rgba(0,0,0,0.24)] sm:max-h-[calc(100dvh-64px)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-semibold leading-7 text-black">Plan Pages</h2>
              <p className="mt-1 text-[13px] leading-5 text-black/50">
                Describe the pages to add, or leave blank and the planner will decide.
              </p>
            </div>
            <button
              aria-label="Close page planner"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[18px] leading-none text-black"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              x
            </button>
          </div>
          <textarea
            aria-label="Page description"
            autoFocus
            className="min-h-[120px] w-full resize-none rounded-[16px] border border-black/10 bg-[#f8f6f2] px-4 py-3 text-[15px] leading-6 text-black outline-none placeholder:text-black/34 focus:border-black/24 sm:min-h-[148px]"
            placeholder="Describe the pages to add, or leave blank"
            value={pagePrompt}
            onChange={(event) => setPagePrompt(event.currentTarget.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                submitPlan();
              }
            }}
          />
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button
              className="rounded-full border border-black/10 bg-white px-5 py-3 text-[14px] font-semibold text-black"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-black px-5 py-3 text-[14px] font-semibold text-white disabled:bg-black/18"
              disabled={!args.canPlan || args.isPlanning}
              type="button"
              onClick={submitPlan}
            >
              {args.isPlanning ? 'Planning' : 'Add Pages'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      {modal}
      <button
        type="button"
        className="shrink-0 rounded-full border border-black/10 bg-white px-5 py-3 text-[15px] font-semibold text-black shadow-[0_12px_26px_rgba(0,0,0,0.08)] outline-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-black/16"
        disabled={!args.canPlan || args.isPlanning}
        onClick={() => setIsOpen(true)}
      >
        {args.isPlanning ? 'Planning' : 'Plan Pages'}
      </button>
    </>
  );
}
