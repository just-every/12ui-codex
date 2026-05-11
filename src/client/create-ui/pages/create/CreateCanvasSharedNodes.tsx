import React from 'react';

import { cn } from '../../lib/cn';

const statusCopy = (status?: string | null): string => {
  if (status === 'completed') return 'Complete';
  if (status === 'failed') return 'Failed';
  if (status === 'running') return 'Running';
  if (status === 'queued') return 'Queued';
  return 'Ready';
};

export const resolveCreateNodeStatusCopy = statusCopy;

export const resolveCreatePageActionLabel = (args: {
  hasRun: boolean;
  isCreating: boolean;
  isStartBlocked: boolean;
}): string => {
  if (args.isCreating) return 'Creating';
  if (args.isStartBlocked) return 'Add source images';
  if (args.hasRun) return 'Create again';
  return 'Create variations';
};

const isCreateShellActionTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLElement && Boolean(target.closest([
    'button',
    'a[href]',
    'label',
    '[role="button"]',
    '[role="slider"]',
  ].join(', ')))
);

const isCreateShellTextFocusTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLElement && Boolean(target.closest([
    'textarea',
    'input',
    'select',
    '[contenteditable="true"]',
    '[role="textbox"]',
  ].join(', ')))
);

export function CreateCanvasShell(args: {
  eyebrow?: string;
  title: string;
  titleClassName?: string;
  onFocusArea?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex h-full flex-col"
      onClickCapture={(event) => {
        if (isCreateShellActionTarget(event.target)) return;
        args.onFocusArea?.();
      }}
      onFocusCapture={(event) => {
        if (!isCreateShellTextFocusTarget(event.target)) return;
        args.onFocusArea?.();
      }}
    >
      <div className={cn('pointer-events-none mb-5', args.eyebrow ? 'min-h-[64px]' : 'min-h-[42px]')}>
        {args.eyebrow ? (
          <div className="block text-[11px] font-semibold uppercase leading-none tracking-[2.2px] text-[#1e5b50]">
            {args.eyebrow}
          </div>
        ) : null}
        <div className={cn(args.eyebrow ? 'mt-2' : '', 'block text-[31px] font-semibold leading-[1.02] text-black', args.titleClassName)}>
          {args.title}
        </div>
      </div>
      {args.children}
    </div>
  );
}
