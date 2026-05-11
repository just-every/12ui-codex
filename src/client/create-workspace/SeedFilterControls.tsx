import React from 'react';
import type {
  DesignAspect,
  DesignCreativityMode,
  DesignQuality,
  DirectDesignCount,
} from '../../shared/types.js';

const DESIGN_COUNT_OPTIONS: DirectDesignCount[] = [1, 3, 6, 12];

const ASPECT_OPTIONS: Array<{ value: DesignAspect; label: string }> = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

const CREATIVITY_MODE_OPTIONS: Array<{ value: DesignCreativityMode; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'creative', label: 'Creative' },
];

const optionText = (count: DirectDesignCount): string => `${count} Design${count === 1 ? '' : 's'}`;

const ChevronDownGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none">
    <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AspectGlyph = ({ aspect }: { aspect: DesignAspect }) => (
  <span
    aria-hidden="true"
    className={aspect === 'portrait'
      ? 'inline-flex h-[18px] w-[12px] rounded-[4px] border border-black/38'
      : 'inline-flex h-[12px] w-[18px] rounded-[4px] border border-black/38'}
  />
);

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose, open]);

  return ref;
}

function DropdownShell({
  align = 'left',
  children,
  isOpen,
  onClose,
  options,
}: {
  align?: 'left' | 'right';
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  options: React.ReactNode;
}) {
  const ref = useOutsideClose(isOpen, onClose);

  return (
    <div ref={ref} className="relative">
      {children}
      {isOpen ? (
        <div
          className={[
            'absolute top-full z-[70] mt-2 min-w-full overflow-hidden rounded-[18px] border border-black/12 bg-white/95 py-1 shadow-[0_12px_28px_rgba(0,0,0,0.08)] backdrop-blur-md',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {options}
        </div>
      ) : null}
    </div>
  );
}

export function SeedFilterControls({
  designCount,
  aspect,
  creativityMode,
  disabled,
  onDesignCountChange,
  onAspectChange,
  onCreativityModeChange,
}: {
  designCount: DirectDesignCount;
  aspect: DesignAspect;
  quality: DesignQuality;
  creativityMode: DesignCreativityMode;
  disabled: boolean;
  onDesignCountChange: (count: DirectDesignCount) => void;
  onAspectChange: (aspect: DesignAspect) => void;
  onQualityChange: (quality: DesignQuality) => void;
  onCreativityModeChange: (creativityMode: DesignCreativityMode) => void;
}) {
  const [openMenu, setOpenMenu] = React.useState<'aspect' | 'count' | null>(null);
  const selectedAspect = ASPECT_OPTIONS.find((option) => option.value === aspect) ?? ASPECT_OPTIONS[0]!;
  const closeMenu = React.useCallback(() => setOpenMenu(null), []);
  const pillClassName = 'flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/12 bg-white/90 text-[13px] font-semibold leading-none text-black transition-colors hover:border-black/24 hover:bg-white focus:border-black/24 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';
  const optionClassName = 'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold leading-none text-black transition-colors hover:bg-black/6';

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div
        className="flex h-10 items-center rounded-full border border-black/12 bg-white/90 p-1"
        role="group"
        aria-label="Creativity mode"
      >
        {CREATIVITY_MODE_OPTIONS.map((option) => {
          const isActive = option.value === creativityMode;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              className={[
                'h-8 rounded-full px-3 text-[13px] font-semibold leading-none transition-colors focus:outline-none',
                isActive ? 'bg-black text-white' : 'text-black/68 hover:bg-black/6 hover:text-black',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              ].join(' ')}
              disabled={disabled}
              onClick={() => onCreativityModeChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <DropdownShell
        isOpen={openMenu === 'aspect'}
        onClose={closeMenu}
        options={ASPECT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={optionClassName}
            onClick={() => {
              onAspectChange(option.value);
              closeMenu();
            }}
          >
            <AspectGlyph aspect={option.value} />
            <span>{option.label}</span>
          </button>
        ))}
      >
        <button
          type="button"
          aria-label="Aspect ratio"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'aspect'}
          className={`${pillClassName} min-w-[136px] px-3`}
          disabled={disabled}
          onClick={() => setOpenMenu((current) => (current === 'aspect' ? null : 'aspect'))}
        >
          <AspectGlyph aspect={aspect} />
          <span>{selectedAspect.label}</span>
          <ChevronDownGlyph />
        </button>
      </DropdownShell>

      <DropdownShell
        isOpen={openMenu === 'count'}
        onClose={closeMenu}
        options={DESIGN_COUNT_OPTIONS.map((count) => (
          <button
            key={count}
            type="button"
            className={optionClassName}
            onClick={() => {
              onDesignCountChange(count);
              closeMenu();
            }}
          >
            {optionText(count)}
          </button>
        ))}
      >
        <button
          type="button"
          aria-label="Design count"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'count'}
          className={`${pillClassName} min-w-[128px] px-2.5`}
          disabled={disabled}
          onClick={() => setOpenMenu((current) => (current === 'count' ? null : 'count'))}
        >
          <span className="font-bold">{designCount}</span>
          <span>{designCount === 1 ? 'Design' : 'Designs'}</span>
          <ChevronDownGlyph />
        </button>
      </DropdownShell>
    </div>
  );
}
