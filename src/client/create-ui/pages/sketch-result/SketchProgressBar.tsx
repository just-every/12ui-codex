import React from 'react';

export function SketchProgressBar({ value }: { value: number }) {
  const width = `${Math.max(0, Math.min(100, value * 100))}%` as `${number}%`;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#eee6d9]" data-testid="sketch-progress-bar">
      <div
        className="h-full rounded-full bg-[#1d1914] transition-[width] duration-500 ease-linear"
        style={{ width }}
      />
    </div>
  );
}
