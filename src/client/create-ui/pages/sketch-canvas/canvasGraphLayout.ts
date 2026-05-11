import {
  rectAnchor,
  type CanvasConnector,
  type CanvasConnectorJunction,
  type CanvasPoint,
  type CanvasRect,
} from './sceneLayout';

type CanvasEdge = 'top' | 'right' | 'bottom' | 'left';

export type CanvasGraphNodeInput = {
  id: string;
  width: number;
  height: number;
};

export type CanvasGraphGroupInput = {
  id: string;
  nodeIds: string[];
  direction: 'right' | 'down' | 'grid';
  gap?: number;
  columnGap?: number;
  rowGap?: number;
  columns?: number;
  start?: CanvasPoint;
  attachTo?: {
    nodeId: string;
    edge: CanvasEdge;
    gap?: number;
    align?: 'start' | 'center' | 'end';
  };
};

export type CanvasGraphEdgeInput = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromEdge?: CanvasEdge;
  toEdge?: CanvasEdge;
  emphasis?: 'default' | 'selected';
  delayMs?: number;
};

export type CanvasGraphLayout = {
  rects: Record<string, CanvasRect>;
  connectors: CanvasConnector[];
  junctions: CanvasConnectorJunction[];
  worldWidth: number;
  worldHeight: number;
};

const DEFAULT_GAP = 80;
const DEFAULT_WORLD_PADDING = 360;

const clampNumber = (value: number, fallback: number): number => (
  Number.isFinite(value) ? value : fallback
);

const resolveGroupSize = (
  nodesById: Map<string, CanvasGraphNodeInput>,
  group: CanvasGraphGroupInput,
): { width: number; height: number } => {
  const gap = clampNumber(group.gap ?? DEFAULT_GAP, DEFAULT_GAP);
  const nodes = group.nodeIds.flatMap((id) => {
    const node = nodesById.get(id);
    return node ? [node] : [];
  });
  if (nodes.length <= 0) return { width: 0, height: 0 };
  if (group.direction === 'right') {
    return {
      width: nodes.reduce((total, node) => total + node.width, 0) + (gap * (nodes.length - 1)),
      height: Math.max(...nodes.map((node) => node.height)),
    };
  }
  if (group.direction === 'grid') {
    const columns = Math.max(1, Math.floor(group.columns ?? 3));
    const columnGap = clampNumber(group.columnGap ?? group.gap ?? DEFAULT_GAP, DEFAULT_GAP);
    const rowGap = clampNumber(group.rowGap ?? group.gap ?? DEFAULT_GAP, DEFAULT_GAP);
    const rows: CanvasGraphNodeInput[][] = [];
    for (let index = 0; index < nodes.length; index += columns) {
      rows.push(nodes.slice(index, index + columns));
    }
    const rowWidths = rows.map((row) => (
      row.reduce((total, node) => total + node.width, 0) + (columnGap * Math.max(0, row.length - 1))
    ));
    const rowHeights = rows.map((row) => Math.max(...row.map((node) => node.height)));
    return {
      width: Math.max(...rowWidths),
      height: rowHeights.reduce((total, height) => total + height, 0) + (rowGap * Math.max(0, rows.length - 1)),
    };
  }
  return {
    width: Math.max(...nodes.map((node) => node.width)),
    height: nodes.reduce((total, node) => total + node.height, 0) + (gap * (nodes.length - 1)),
  };
};

const resolveAttachedStart = (args: {
  parent: CanvasRect;
  groupSize: { width: number; height: number };
  attachTo: NonNullable<CanvasGraphGroupInput['attachTo']>;
}): CanvasPoint => {
  const gap = clampNumber(args.attachTo.gap ?? DEFAULT_GAP, DEFAULT_GAP);
  const align = args.attachTo.align ?? 'start';
  const alignX = align === 'center'
    ? args.parent.x + ((args.parent.width - args.groupSize.width) / 2)
    : align === 'end'
      ? args.parent.x + args.parent.width - args.groupSize.width
      : args.parent.x;
  const alignY = align === 'center'
    ? args.parent.y + ((args.parent.height - args.groupSize.height) / 2)
    : align === 'end'
      ? args.parent.y + args.parent.height - args.groupSize.height
      : args.parent.y;

  if (args.attachTo.edge === 'right') {
    return { x: args.parent.x + args.parent.width + gap, y: alignY };
  }
  if (args.attachTo.edge === 'left') {
    return { x: args.parent.x - gap - args.groupSize.width, y: alignY };
  }
  if (args.attachTo.edge === 'bottom') {
    return { x: alignX, y: args.parent.y + args.parent.height + gap };
  }
  return { x: alignX, y: args.parent.y - gap - args.groupSize.height };
};

const placeGroup = (args: {
  nodesById: Map<string, CanvasGraphNodeInput>;
  rects: Record<string, CanvasRect>;
  group: CanvasGraphGroupInput;
}): boolean => {
  const groupSize = resolveGroupSize(args.nodesById, args.group);
  let start = args.group.start ?? null;
  if (!start && args.group.attachTo) {
    const parent = args.rects[args.group.attachTo.nodeId];
    if (!parent) return false;
    start = resolveAttachedStart({
      parent,
      groupSize,
      attachTo: args.group.attachTo,
    });
  }
  if (!start) return false;

  const gap = clampNumber(args.group.gap ?? DEFAULT_GAP, DEFAULT_GAP);
  if (args.group.direction === 'grid') {
    const columns = Math.max(1, Math.floor(args.group.columns ?? 3));
    const columnGap = clampNumber(args.group.columnGap ?? args.group.gap ?? DEFAULT_GAP, DEFAULT_GAP);
    const rowGap = clampNumber(args.group.rowGap ?? args.group.gap ?? DEFAULT_GAP, DEFAULT_GAP);
    let cursorY = start.y;
    for (let rowStart = 0; rowStart < args.group.nodeIds.length; rowStart += columns) {
      const rowIds = args.group.nodeIds.slice(rowStart, rowStart + columns);
      let cursorX = start.x;
      let rowHeight = 0;
      for (const nodeId of rowIds) {
        const node = args.nodesById.get(nodeId);
        if (!node) continue;
        args.rects[nodeId] = {
          x: cursorX,
          y: cursorY,
          width: node.width,
          height: node.height,
        };
        cursorX += node.width + columnGap;
        rowHeight = Math.max(rowHeight, node.height);
      }
      cursorY += rowHeight + rowGap;
    }
    return true;
  }

  let cursorX = start.x;
  let cursorY = start.y;
  for (const nodeId of args.group.nodeIds) {
    const node = args.nodesById.get(nodeId);
    if (!node) continue;
    args.rects[nodeId] = {
      x: cursorX,
      y: cursorY,
      width: node.width,
      height: node.height,
    };
    if (args.group.direction === 'right') {
      cursorX += node.width + gap;
    } else {
      cursorY += node.height + gap;
    }
  }
  return true;
};

const oppositeEdge = (edge: CanvasEdge): CanvasEdge => {
  if (edge === 'top') return 'bottom';
  if (edge === 'right') return 'left';
  if (edge === 'bottom') return 'top';
  return 'right';
};

const buildEdgeConnector = (
  edge: CanvasGraphEdgeInput,
  rects: Record<string, CanvasRect>,
): CanvasConnector | null => {
  const fromRect = rects[edge.fromNodeId];
  const toRect = rects[edge.toNodeId];
  if (!fromRect || !toRect) return null;
  const fromEdge = edge.fromEdge ?? 'right';
  const toEdge = edge.toEdge ?? oppositeEdge(fromEdge);
  return {
    id: edge.id,
    from: rectAnchor(fromRect, fromEdge, 0.5, 0),
    fromEdge,
    to: rectAnchor(toRect, toEdge, 0.5, 0),
    toEdge,
    emphasis: edge.emphasis,
    delayMs: edge.delayMs,
  };
};

export const buildCanvasGraphLayout = (args: {
  nodes: CanvasGraphNodeInput[];
  groups: CanvasGraphGroupInput[];
  edges?: CanvasGraphEdgeInput[];
  worldPadding?: number;
}): CanvasGraphLayout => {
  const nodesById = new Map(args.nodes.map((node) => [node.id, node]));
  const rects: Record<string, CanvasRect> = {};
  const pendingGroups = [...args.groups];
  let didPlace = true;

  while (pendingGroups.length > 0 && didPlace) {
    didPlace = false;
    for (let index = pendingGroups.length - 1; index >= 0; index -= 1) {
      const group = pendingGroups[index]!;
      if (placeGroup({ nodesById, rects, group })) {
        pendingGroups.splice(index, 1);
        didPlace = true;
      }
    }
  }

  for (const group of pendingGroups) {
    placeGroup({
      nodesById,
      rects,
      group: {
        ...group,
        start: group.start ?? { x: 0, y: 0 },
        attachTo: undefined,
      },
    });
  }

  const placedRects = Object.values(rects);
  const bounds = placedRects.reduce<{
    maxX: number;
    maxY: number;
  }>((current, rect) => ({
    maxX: Math.max(current.maxX, rect.x + rect.width),
    maxY: Math.max(current.maxY, rect.y + rect.height),
  }), { maxX: 0, maxY: 0 });
  const worldPadding = clampNumber(args.worldPadding ?? DEFAULT_WORLD_PADDING, DEFAULT_WORLD_PADDING);

  return {
    rects,
    connectors: (args.edges ?? []).flatMap((edge) => {
      const connector = buildEdgeConnector(edge, rects);
      return connector ? [connector] : [];
    }),
    junctions: [],
    worldWidth: Math.max(1600, Math.ceil(bounds.maxX + worldPadding)),
    worldHeight: Math.max(1100, Math.ceil(bounds.maxY + worldPadding)),
  };
};
