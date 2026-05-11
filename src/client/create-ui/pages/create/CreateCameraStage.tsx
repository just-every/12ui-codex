import React from 'react';

import { SketchCanvasStage } from '../sketch-canvas/SketchCanvasStage';
import type { CanvasConnector, CanvasConnectorJunction, InfiniteCanvasCamera } from '../sketch-canvas/sceneLayout';
import { useInfiniteCanvasCamera } from '../sketch-canvas/useInfiniteCanvasCamera';

export function CreateCameraStage(args: {
  targetCamera: InfiniteCanvasCamera;
  minZoom: number;
  maxZoom: number;
  preserveUserCameraOnTargetChange?: boolean;
  worldWidth: number;
  worldHeight: number;
  connectors: CanvasConnector[];
  connectorJunctions?: CanvasConnectorJunction[];
  introStartedAt?: number | null;
  overlay?: React.ReactNode;
  dragHandlers?: {
    onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  };
  onHorizontalNavigate: (direction: 'prev' | 'next') => void;
  onCanvasClick: (args: {
    target: HTMLElement;
    worldX: number;
    worldY: number;
  }) => void;
  children: React.ReactNode;
}) {
  const camera = useInfiniteCanvasCamera({
    targetCamera: args.targetCamera,
    minZoom: args.minZoom,
    maxZoom: args.maxZoom,
    preserveUserCameraOnTargetChange: args.preserveUserCameraOnTargetChange,
    onHorizontalNavigate: args.onHorizontalNavigate,
    onCanvasClick: args.onCanvasClick,
  });

  return (
    <SketchCanvasStage
      camera={camera.camera}
      isDragging={camera.isDragging}
      worldWidth={args.worldWidth}
      worldHeight={args.worldHeight}
      connectors={args.connectors}
      connectorJunctions={args.connectorJunctions}
      introStartedAt={args.introStartedAt}
      overlay={args.overlay}
      stageHandlers={camera.stageHandlers}
      dragHandlers={args.dragHandlers}
    >
      {args.children}
    </SketchCanvasStage>
  );
}
