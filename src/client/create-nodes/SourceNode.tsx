import React from 'react';

export function SourceNode({ index, dataUrl }: { index: number; dataUrl: string }) {
  return (
    <div className="sourceNode">
      <img src={dataUrl} alt={`Reference ${index + 1}`} decoding="async" loading="lazy" />
      <span>Ref {index + 1}</span>
    </div>
  );
}
