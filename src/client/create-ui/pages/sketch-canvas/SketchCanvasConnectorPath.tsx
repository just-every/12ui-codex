import React from 'react';

import type { CanvasConnector, CanvasConnectorJunction } from './sceneLayout';
import { buildConnectorPath } from './sceneLayout';

const CONNECTOR_PADDING = 640;

export const resolveConnectorStroke = (emphasis?: 'default' | 'selected'): string => (
  emphasis === 'selected' ? 'rgba(31, 24, 20, 0.92)' : 'rgba(31, 24, 20, 0.42)'
);

export const resolveConnectorStrokeWidth = (emphasis?: 'default' | 'selected'): number => (
  emphasis === 'selected' ? 2.75 : 1.75
);

export function SketchCanvasConnectorPath(args: {
  connector: CanvasConnector;
  animationDelayMs?: number;
}) {
  const animationDelayMs = args.animationDelayMs ?? args.connector.delayMs ?? 0;
  return (
    <path
      d={buildConnectorPath(args.connector)}
      pathLength={1}
      className="sketch-canvas-connector"
      style={{
        opacity: 0,
        animationDelay: `${animationDelayMs}ms`,
        animationFillMode: 'both',
      }}
      fill="none"
      stroke={resolveConnectorStroke(args.connector.emphasis)}
      strokeWidth={resolveConnectorStrokeWidth(args.connector.emphasis)}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={1}
      strokeDashoffset={1}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function SketchCanvasConnectorJunction(args: {
  junction: CanvasConnectorJunction;
  animationDelayMs?: number;
}) {
  const animationDelayMs = args.animationDelayMs ?? args.junction.delayMs ?? 0;
  return (
    <circle
      cx={args.junction.center.x}
      cy={args.junction.center.y}
      r={6.5}
      className="sketch-canvas-connector-junction"
      style={{
        opacity: 0,
        animationDelay: `${animationDelayMs}ms`,
        animationFillMode: 'both',
      }}
      fill={resolveConnectorStroke(args.junction.emphasis)}
      stroke="rgba(255, 255, 255, 0.92)"
      strokeWidth={3}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function SketchCanvasConnectorOverlay(args: {
  connector: CanvasConnector;
}) {
  const minX = Math.min(args.connector.from.x, args.connector.to.x) - CONNECTOR_PADDING;
  const minY = Math.min(args.connector.from.y, args.connector.to.y) - CONNECTOR_PADDING;
  const maxX = Math.max(args.connector.from.x, args.connector.to.x) + CONNECTOR_PADDING;
  const maxY = Math.max(args.connector.from.y, args.connector.to.y) + CONNECTOR_PADDING;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${minX}px`,
        top: `${minY}px`,
        width: `${width}px`,
        height: `${height}px`,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
      width={width}
      height={height}
      viewBox={`${minX} ${minY} ${width} ${height}`}
    >
      <SketchCanvasConnectorPath connector={args.connector} />
    </svg>
  );
}
