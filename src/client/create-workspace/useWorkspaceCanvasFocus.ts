import React from 'react';

import {
  CREATE_CANVAS_ALL_FOCUS_ID,
  isCreateFocusNavigationBlockedTarget,
  resolveCreateFocusAreaAtPoint,
  type CreateCanvasFocusArea,
} from '../create-ui/pages/create/createCanvasFocus';
import { CREATE_SEED_NODE_ID } from '../create-ui/pages/create/createCanvasLayout';

export const useWorkspaceCanvasFocus = (args: {
  defaultFocusAreaId?: string | null;
  focusAreas: CreateCanvasFocusArea[];
  isMobileCanvas: boolean;
}) => {
  const [focusedAreaId, setFocusedAreaId] = React.useState<string | null>(null);
  const [focusedAreaSnapshot, setFocusedAreaSnapshot] = React.useState<CreateCanvasFocusArea | null>(null);
  const [pendingFocusAreaId, setPendingFocusAreaId] = React.useState<string | null>(null);
  const hasUserChosenFocusRef = React.useRef(false);

  const applyFocusArea = React.useCallback((focusAreaId: string) => {
    const area = args.focusAreas.find((entry) => entry.id === focusAreaId) ?? null;
    if (!area) return false;
    setFocusedAreaId(area.id);
    setFocusedAreaSnapshot(area);
    return true;
  }, [args.focusAreas]);

  const requestFocusArea = React.useCallback((focusAreaId: string) => {
    hasUserChosenFocusRef.current = true;
    if (applyFocusArea(focusAreaId)) {
      setPendingFocusAreaId(null);
      return;
    }
    setPendingFocusAreaId(focusAreaId);
  }, [applyFocusArea]);

  React.useEffect(() => {
    if (hasUserChosenFocusRef.current || !args.defaultFocusAreaId) return;
    if (focusedAreaId === args.defaultFocusAreaId && focusedAreaSnapshot?.id === args.defaultFocusAreaId) return;
    applyFocusArea(args.defaultFocusAreaId);
  }, [applyFocusArea, args.defaultFocusAreaId, focusedAreaId, focusedAreaSnapshot?.id]);

  React.useEffect(() => {
    if (!pendingFocusAreaId) return;
    if (applyFocusArea(pendingFocusAreaId)) {
      setPendingFocusAreaId(null);
    }
  }, [applyFocusArea, pendingFocusAreaId]);

  React.useEffect(() => {
    if (focusedAreaId) {
      const area = args.focusAreas.find((entry) => entry.id === focusedAreaId) ?? null;
      if (area && focusedAreaSnapshot?.id === area.id) return;
      if (area && !focusedAreaSnapshot) {
        setFocusedAreaSnapshot(area);
        return;
      }
    }
    const fallback = (args.defaultFocusAreaId
      ? args.focusAreas.find((area) => area.id === args.defaultFocusAreaId)
      : null)
      ?? args.focusAreas.find((area) => area.id === CREATE_SEED_NODE_ID)
      ?? args.focusAreas.find((area) => area.id === CREATE_CANVAS_ALL_FOCUS_ID)
      ?? args.focusAreas[0]
      ?? null;
    if (!fallback) return;
    setFocusedAreaId(fallback.id);
    setFocusedAreaSnapshot(fallback);
  }, [args.defaultFocusAreaId, args.focusAreas, focusedAreaId, focusedAreaSnapshot]);

  const cameraSettings = React.useMemo(() => {
    switch (focusedAreaSnapshot?.kind) {
      case 'seed':
        return { padding: args.isMobileCanvas ? 20 : 64, minZoom: args.isMobileCanvas ? 0.2 : 0.22, maxZoom: 1.2 };
      case 'source':
        return { padding: args.isMobileCanvas ? 24 : 64, minZoom: 0.2, maxZoom: 1.45 };
      case 'seed-variation-group':
      case 'variation-group':
        return { padding: args.isMobileCanvas ? 24 : 72, minZoom: 0.2, maxZoom: 0.95 };
      case 'seed-variation':
      case 'variation':
        return { padding: args.isMobileCanvas ? 24 : 56, minZoom: args.isMobileCanvas ? 0.2 : 0.24, maxZoom: 2.2 };
      case 'page':
        return { padding: args.isMobileCanvas ? 24 : 64, minZoom: 0.22, maxZoom: 1.35 };
      case 'planner':
        return { padding: args.isMobileCanvas ? 24 : 72, minZoom: 0.2, maxZoom: 1.2 };
      case 'export':
        return { padding: args.isMobileCanvas ? 24 : 64, minZoom: 0.22, maxZoom: 1.45 };
      case 'all':
      default:
        return { padding: args.isMobileCanvas ? 20 : 120, minZoom: args.isMobileCanvas ? 0.2 : 0.24, maxZoom: args.isMobileCanvas ? 1.2 : 0.78 };
    }
  }, [args.isMobileCanvas, focusedAreaSnapshot?.kind]);

  const handleFocusStep = React.useCallback((direction: 'prev' | 'next') => {
    if (args.focusAreas.length === 0) return;
    const resolvedIndex = args.focusAreas.findIndex((area) => area.id === focusedAreaId);
    const currentIndex = resolvedIndex >= 0
      ? resolvedIndex
      : Math.max(0, args.focusAreas.findIndex((area) => area.id === CREATE_CANVAS_ALL_FOCUS_ID));
    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % args.focusAreas.length
      : (currentIndex - 1 + args.focusAreas.length) % args.focusAreas.length;
    const nextArea = args.focusAreas[nextIndex];
    if (nextArea) {
      hasUserChosenFocusRef.current = true;
      applyFocusArea(nextArea.id);
    }
  }, [applyFocusArea, args.focusAreas, focusedAreaId]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCreateFocusNavigationBlockedTarget(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleFocusStep('prev');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleFocusStep('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleFocusStep]);

  const handleCanvasAreaClick = React.useCallback((args_: {
    target: HTMLElement;
    worldX: number;
    worldY: number;
  }) => {
    const explicitAreaId = args_.target.closest<HTMLElement>('[data-focus-area-id]')?.dataset.focusAreaId;
    if (explicitAreaId && args.focusAreas.some((area) => area.id === explicitAreaId)) {
      hasUserChosenFocusRef.current = true;
      applyFocusArea(explicitAreaId);
      return;
    }
    const hitAreaId = resolveCreateFocusAreaAtPoint(args.focusAreas, { x: args_.worldX, y: args_.worldY });
    if (hitAreaId) {
      hasUserChosenFocusRef.current = true;
      applyFocusArea(hitAreaId);
    }
  }, [applyFocusArea, args.focusAreas]);

  return {
    cameraSettings,
    focusedAreaSnapshot,
    handleCanvasAreaClick,
    handleFocusStep,
    requestFocusArea,
  };
};
