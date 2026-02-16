import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import RoomObject from "./RoomObject";
import type { LayoutInteractionTelemetry, MeasureLine, OpeningWall, RoomItem } from "../types";
import { fromBaseCm } from "../utils/units";
import { inferWallFromRotation, isOpening, snapOpeningToNearestWall } from "../utils/openings";
import {
  applyMeasureConstraint,
  getBedPresetIndex,
  projectPointToSegmentT,
  subtractIntervals,
  type MeasureConstraintResult,
  type Point,
} from "../utils/roomCanvasMath";
import { clamp, getBoundingBox } from "../utils/geometry";
import { BED_SIZE_PRESETS } from "../constants/objectPresets";
import {
  createSelectionBounds,
  getSelectableItemIds,
  getSelectionDragDistance,
  getSelectionSize,
  type SelectionPoint,
} from "../utils/selectionBox";
import { hasPointerExceededDragThreshold } from "../utils/pointerDrag";

interface RoomCanvasProps {
  items: RoomItem[];
  onItemsChange: Dispatch<SetStateAction<RoomItem[]>>;
  onEditItem: (id: number | null) => void;
  selectedItemId: number | null;
  selectedItemIds?: number[];
  onSelectItems?: (ids: number[]) => void;
  roomWidthCm?: number;
  roomHeightCm?: number;
  wallThicknessCm?: number;
  allowResize?: boolean;
  onRoomSizeChange?: (roomWidthCm: number, roomHeightCm: number) => void;
  gridSpacingCm?: number;
  gridColor?: string;
  unit?: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  onLayoutInteractionStart?: () => void;
  onLayoutInteractionEnd?: () => void;
  onLayoutTelemetry?: (sample: LayoutInteractionTelemetry) => void;
  exportRoomId?: string;
  measures?: MeasureLine[];
  onMeasuresChange?: Dispatch<SetStateAction<MeasureLine[]>>;
  dimensionLabelLayout?: {
    widthLabelT: number;
    heightLabelT: number;
  };
  onDimensionLabelLayoutChange?: Dispatch<SetStateAction<{ widthLabelT: number; heightLabelT: number }>>;
  measureMode?: boolean;
  selectedMeasureId?: number | null;
  onSelectMeasure?: (id: number | null) => void;
  onMeasureCreated?: (measureId: number) => void;
  isExportingPdf?: boolean;
}

interface TelemetrySession {
  interaction: 'drag' | 'resize';
  itemType?: string;
  startAt: number;
  pointerEvents: number;
  frameSamples: number;
  frameMsTotal: number;
  maxFrameMs: number;
  slowFrameCount: number;
  changed: boolean;
  lastFrameAt: number | null;
}

interface MeasureSnapPreview {
  anchor: Point;
  point: Point;
  snapped: Point[];
}

interface ObjectResizeState {
  itemId: number;
  handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  startItem: RoomItem;
  basePresetIndex: number;
  currentPresetIndex: number;
}

interface DragGroupState {
  pointerStart: Point;
  members: Array<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotate?: number;
  }>;
}

interface SelectionDraft {
  start: SelectionPoint;
  end: SelectionPoint;
}

interface WallSegment {
  key: string;
  wall: OpeningWall;
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerlineStart: Point;
  centerlineEnd: Point;
}

const SLOW_FRAME_THRESHOLD_MS = 24;
const MIN_MEASURE_LENGTH_CM = 2;
const MEASURE_SNAP_THRESHOLD_CM = 12;
const CANVAS_PADDING_PX = 40;
const EXPORT_CANVAS_PADDING_PX = 96;
const WINDOW_LABEL_OUTSET_CM = 16;
const WINDOW_SIDE_LABEL_EXTRA_CM = 22;
const DOOR_LABEL_OUTSET_CM = 12;
const DOOR_SIDE_LABEL_EXTRA_CM = 8;
const DIMENSION_LABEL_OFFSET_CM = 18;
const WALL_PADDING_CM = 28;
const BED_PRESET_DRAG_STEP_CM = 24;
const MIN_WALL_MEASURE_TARGET_LENGTH_CM = 14;
const MIN_BOX_SELECTION_DRAG_CM = 4;
const MIN_OBJECT_DRAG_DISTANCE_CM = 2;

const resolveOpeningWall = (item: RoomItem): OpeningWall => item.openingWall ?? inferWallFromRotation(item.rotate) ?? 'bottom';

const getDoorWallCenterOffset = (wall: OpeningWall, wallThicknessCm: number): Point => {
  if (wall === 'top') return { x: 0, y: -wallThicknessCm / 2 };
  if (wall === 'bottom') return { x: 0, y: wallThicknessCm / 2 };
  if (wall === 'left') return { x: -wallThicknessCm / 2, y: 0 };
  return { x: wallThicknessCm / 2, y: 0 };
};

const distanceBetween = (left: Point, right: Point): number => Math.hypot(right.x - left.x, right.y - left.y);

const getNextMeasureId = (measures: MeasureLine[]): number => {
  const maxId = measures.reduce((max, measure) => Math.max(max, measure.id), 0);
  return maxId + 1;
};

const toPointInRoom = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
  roomWidthCm: number,
  roomHeightCm: number
): Point => ({
  x: clamp(clientX - rect.left, 0, roomWidthCm),
  y: clamp(clientY - rect.top, 0, roomHeightCm),
});

const getRotatedCorners = (item: RoomItem): Point[] => {
  const rotate = item.rotate ?? 0;
  const rad = (rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const centerX = item.x + item.width / 2;
  const centerY = item.y + item.height / 2;
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];

  return corners.map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));
};

const getRotatedMidpoints = (item: RoomItem): Point[] => {
  const corners = getRotatedCorners(item);
  return [
    { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
    { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
    { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
    { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 },
  ];
};

const getMeasureAnchorsForItem = (item: RoomItem): Point[] => {
  const corners = getRotatedCorners(item);
  const midpoints = getRotatedMidpoints(item);
  return [...corners, ...midpoints];
};

const normalizeMeasure = (measure: MeasureLine): MeasureLine => ({
  ...measure,
  labelT: clamp(measure.labelT ?? 0.5, 0, 1),
});

const rotationToRadians = (rotation = 0): number => (rotation * Math.PI) / 180;

const worldToLocal = (point: Point, center: Point, rotation = 0): Point => {
  const rad = rotationToRadians(rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
};

const localToWorld = (point: Point, center: Point, rotation = 0): Point => {
  const rad = rotationToRadians(rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: center.x + point.x * cos - point.y * sin,
    y: center.y + point.x * sin + point.y * cos,
  };
};

function RoomCanvasComponent({
  items,
  onItemsChange,
  onEditItem,
  selectedItemId,
  selectedItemIds = [],
  onSelectItems,
  roomWidthCm = 800,
  roomHeightCm = 600,
  wallThicknessCm = 12,
  allowResize = true,
  onRoomSizeChange,
  gridSpacingCm = 30,
  gridColor,
  unit = 'cm',
  onLayoutInteractionStart,
  onLayoutInteractionEnd,
  onLayoutTelemetry,
  exportRoomId,
  measures = [],
  onMeasuresChange,
  dimensionLabelLayout,
  onDimensionLabelLayoutChange,
  measureMode = false,
  selectedMeasureId = null,
  onSelectMeasure,
  onMeasureCreated,
  isExportingPdf = false,
}: RoomCanvasProps) {
  const [width, setWidth] = useState(roomWidthCm);
  const [height, setHeight] = useState(roomHeightCm);
  const [localItems, setLocalItems] = useState(items);
  const [localMeasures, setLocalMeasures] = useState(measures.map(normalizeMeasure));
  const [isResizing, setIsResizing] = useState<null | 'right' | 'bottom' | 'corner'>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragGroupState, setDragGroupState] = useState<DragGroupState | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [draftMeasure, setDraftMeasure] = useState<MeasureLine | null>(null);
  const [measureSnapPreview, setMeasureSnapPreview] = useState<MeasureSnapPreview | null>(null);
  const [objectResizeState, setObjectResizeState] = useState<ObjectResizeState | null>(null);
  const [bedPresetHint, setBedPresetHint] = useState<{ name: string; x: number; y: number } | null>(null);
  const [localDimensionLabelLayout, setLocalDimensionLabelLayout] = useState(() => ({
    widthLabelT: clamp(dimensionLabelLayout?.widthLabelT ?? 0.5, 0, 1),
    heightLabelT: clamp(dimensionLabelLayout?.heightLabelT ?? 0.5, 0, 1),
  }));
  const [hoveredMeasureAnchorKey, setHoveredMeasureAnchorKey] = useState<string | null>(null);
  const [hoveredWallMeasureKey, setHoveredWallMeasureKey] = useState<string | null>(null);
  const [activeWallMeasureKey, setActiveWallMeasureKey] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const localItemsRef = useRef(localItems);
  const localMeasuresRef = useRef(localMeasures);
  const draftMeasureRef = useRef<MeasureLine | null>(draftMeasure);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const dragOffsetRef = useRef(dragOffset);
  const draggingIdRef = useRef<number | null>(draggingId);
  const dragGroupStateRef = useRef<DragGroupState | null>(dragGroupState);
  const selectedItemIdsRef = useRef<number[]>(selectedItemIds);
  const isResizingRef = useRef<null | 'right' | 'bottom' | 'corner'>(isResizing);
  const objectResizeStateRef = useRef<ObjectResizeState | null>(objectResizeState);
  const localDimensionLabelLayoutRef = useRef(localDimensionLabelLayout);
  const itemsDirtyRef = useRef(false);
  const sizeDirtyRef = useRef(false);
  const measuresDirtyRef = useRef(false);
  const activeMeasureDragRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const dragStartClientRef = useRef<Point | null>(null);
  const objectDragThresholdMetRef = useRef(false);
  const activeInteractionPointerIdRef = useRef<number | null>(null);
  const telemetrySessionRef = useRef<TelemetrySession | null>(null);
  const measureCreateHandlersRef = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
  } | null>(null);
  const measureEndpointHandlersRef = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
  } | null>(null);
  const measureCreatePointerIdRef = useRef<number | null>(null);
  const measureEndpointPointerIdRef = useRef<number | null>(null);
  const measureInteractionActiveRef = useRef(false);
  const measureLabelHandlersRef = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
  } | null>(null);
  const measureLabelPointerIdRef = useRef<number | null>(null);
  const dimensionLabelHandlersRef = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
  } | null>(null);
  const dimensionLabelPointerIdRef = useRef<number | null>(null);
  const boxSelectionHandlersRef = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
  } | null>(null);
  const boxSelectionPointerIdRef = useRef<number | null>(null);

  const setNextLocalItems = useCallback((next: RoomItem[]) => {
    localItemsRef.current = next;
    setLocalItems(next);
  }, []);

  const setNextLocalMeasures = useCallback((next: MeasureLine[]) => {
    const normalized = next.map(normalizeMeasure);
    localMeasuresRef.current = normalized;
    setLocalMeasures(normalized);
  }, []);

  const setNextDimensionLabelLayout = useCallback((next: { widthLabelT: number; heightLabelT: number }) => {
    const normalized = {
      widthLabelT: clamp(next.widthLabelT, 0, 1),
      heightLabelT: clamp(next.heightLabelT, 0, 1),
    };
    localDimensionLabelLayoutRef.current = normalized;
    setLocalDimensionLabelLayout(normalized);
  }, []);

  const detachMeasureCreateListeners = useCallback(() => {
    const handlers = measureCreateHandlersRef.current;
    if (!handlers) return;
    window.removeEventListener('pointermove', handlers.onMove);
    window.removeEventListener('pointerup', handlers.onUp);
    window.removeEventListener('pointercancel', handlers.onUp);
    measureCreateHandlersRef.current = null;
    measureCreatePointerIdRef.current = null;
    setActiveWallMeasureKey(null);
  }, []);

  const detachMeasureEndpointListeners = useCallback(() => {
    const handlers = measureEndpointHandlersRef.current;
    if (!handlers) return;
    window.removeEventListener('pointermove', handlers.onMove);
    window.removeEventListener('pointerup', handlers.onUp);
    window.removeEventListener('pointercancel', handlers.onUp);
    measureEndpointHandlersRef.current = null;
    measureEndpointPointerIdRef.current = null;
  }, []);

  const detachMeasureLabelListeners = useCallback(() => {
    const handlers = measureLabelHandlersRef.current;
    if (!handlers) return;
    window.removeEventListener('pointermove', handlers.onMove);
    window.removeEventListener('pointerup', handlers.onUp);
    window.removeEventListener('pointercancel', handlers.onUp);
    measureLabelHandlersRef.current = null;
    measureLabelPointerIdRef.current = null;
  }, []);

  const detachDimensionLabelListeners = useCallback(() => {
    const handlers = dimensionLabelHandlersRef.current;
    if (!handlers) return;
    window.removeEventListener('pointermove', handlers.onMove);
    window.removeEventListener('pointerup', handlers.onUp);
    window.removeEventListener('pointercancel', handlers.onUp);
    dimensionLabelHandlersRef.current = null;
    dimensionLabelPointerIdRef.current = null;
  }, []);

  const detachBoxSelectionListeners = useCallback(() => {
    const handlers = boxSelectionHandlersRef.current;
    if (!handlers) return;
    window.removeEventListener('pointermove', handlers.onMove);
    window.removeEventListener('pointerup', handlers.onUp);
    window.removeEventListener('pointercancel', handlers.onUp);
    boxSelectionHandlersRef.current = null;
    boxSelectionPointerIdRef.current = null;
  }, []);

  useEffect(() => {
    setWidth(roomWidthCm);
  }, [roomWidthCm]);

  useEffect(() => {
    setHeight(roomHeightCm);
  }, [roomHeightCm]);

  useEffect(() => {
    if (draggingIdRef.current !== null) return;
    setNextLocalItems(items);
    itemsDirtyRef.current = false;
  }, [items, setNextLocalItems]);

  useEffect(() => {
    if (activeMeasureDragRef.current || draftMeasureRef.current) return;
    setNextLocalMeasures(measures);
    measuresDirtyRef.current = false;
  }, [measures, setNextLocalMeasures]);

  useEffect(() => {
    if (dimensionLabelPointerIdRef.current !== null) return;
    setNextDimensionLabelLayout({
      widthLabelT: dimensionLabelLayout?.widthLabelT ?? 0.5,
      heightLabelT: dimensionLabelLayout?.heightLabelT ?? 0.5,
    });
  }, [dimensionLabelLayout, setNextDimensionLabelLayout]);

  useEffect(() => {
    localItemsRef.current = localItems;
  }, [localItems]);

  useEffect(() => {
    localMeasuresRef.current = localMeasures;
  }, [localMeasures]);

  useEffect(() => {
    draftMeasureRef.current = draftMeasure;
  }, [draftMeasure]);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);

  useEffect(() => {
    dragGroupStateRef.current = dragGroupState;
  }, [dragGroupState]);

  useEffect(() => {
    selectedItemIdsRef.current = selectedItemIds;
  }, [selectedItemIds]);

  useEffect(() => {
    isResizingRef.current = isResizing;
  }, [isResizing]);

  useEffect(() => {
    objectResizeStateRef.current = objectResizeState;
  }, [objectResizeState]);

  useEffect(() => {
    localDimensionLabelLayoutRef.current = localDimensionLabelLayout;
  }, [localDimensionLabelLayout]);

  useEffect(() => {
    if (measureMode && !isExportingPdf) return;
    detachBoxSelectionListeners();
    setSelectionDraft(null);
    detachMeasureCreateListeners();
    detachMeasureEndpointListeners();
    detachMeasureLabelListeners();
    activeMeasureDragRef.current = false;
    setDraftMeasure(null);
    setMeasureSnapPreview(null);
    setHoveredMeasureAnchorKey(null);
    setHoveredWallMeasureKey(null);
    setActiveWallMeasureKey(null);
    if (measureInteractionActiveRef.current) {
      measureInteractionActiveRef.current = false;
      onLayoutInteractionEnd?.();
    }
  }, [
    detachMeasureCreateListeners,
    detachBoxSelectionListeners,
    detachMeasureEndpointListeners,
    detachMeasureLabelListeners,
    isExportingPdf,
    measureMode,
    onLayoutInteractionEnd,
  ]);

  const snapTargets = useMemo(() => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];

    if (!measureMode) {
      return points;
    }

    localItems.forEach((item) => {
      if (isOpening(item)) return;
      getMeasureAnchorsForItem(item).forEach((corner) => {
        points.push({
          x: clamp(corner.x, 0, width),
          y: clamp(corner.y, 0, height),
        });
      });
    });

    return points;
  }, [height, localItems, measureMode, width]);

  const measureTargetGeometry = useMemo(() => {
    if (!measureMode || isExportingPdf) return [];
    return localItems
      .filter((item) => !isOpening(item))
      .map((item) => {
        const corners = getRotatedCorners(item);
        const anchors = getMeasureAnchorsForItem(item).map((point, index) => ({
          key: `${item.id}-${index}`,
          point: {
            x: clamp(point.x, 0, width),
            y: clamp(point.y, 0, height),
          },
        }));
        return {
          itemId: item.id,
          polygon: corners.map((point) => `${clamp(point.x, 0, width)},${clamp(point.y, 0, height)}`).join(' '),
          anchors,
        };
      });
  }, [height, isExportingPdf, localItems, measureMode, width]);

  const startTelemetrySession = useCallback((interaction: 'drag' | 'resize', itemType?: string) => {
    telemetrySessionRef.current = {
      interaction,
      itemType,
      startAt: performance.now(),
      pointerEvents: 0,
      frameSamples: 0,
      frameMsTotal: 0,
      maxFrameMs: 0,
      slowFrameCount: 0,
      changed: false,
      lastFrameAt: null,
    };
  }, []);

  const markTelemetryChanged = useCallback(() => {
    if (!telemetrySessionRef.current) return;
    telemetrySessionRef.current.changed = true;
  }, []);

  const recordPointerEvent = useCallback(() => {
    if (!telemetrySessionRef.current) return;
    telemetrySessionRef.current.pointerEvents += 1;
  }, []);

  const recordAppliedFrame = useCallback(() => {
    const session = telemetrySessionRef.current;
    if (!session) return;

    const now = performance.now();
    if (session.lastFrameAt !== null) {
      const delta = now - session.lastFrameAt;
      session.frameSamples += 1;
      session.frameMsTotal += delta;
      session.maxFrameMs = Math.max(session.maxFrameMs, delta);
      if (delta >= SLOW_FRAME_THRESHOLD_MS) {
        session.slowFrameCount += 1;
      }
    }
    session.lastFrameAt = now;
  }, []);

  const flushTelemetrySession = useCallback(() => {
    const session = telemetrySessionRef.current;
    telemetrySessionRef.current = null;
    if (!session) return;

    const durationMs = performance.now() - session.startAt;
    const avgFrameMs = session.frameSamples > 0 ? session.frameMsTotal / session.frameSamples : 0;

    onLayoutTelemetry?.({
      interaction: session.interaction,
      itemType: session.itemType,
      changed: session.changed,
      durationMs,
      pointerEvents: session.pointerEvents,
      frameSamples: session.frameSamples,
      avgFrameMs,
      maxFrameMs: session.maxFrameMs,
      slowFrameCount: session.slowFrameCount,
      timestamp: Date.now(),
    });
  }, [onLayoutTelemetry]);

  const applyPointerMovement = useCallback((clientX: number, clientY: number) => {
    const activeResize = isResizingRef.current;
    const activeDraggingId = draggingIdRef.current;
    const activeObjectResize = objectResizeStateRef.current;

    const resolveHandleSigns = (handle: ObjectResizeState['handle']): { sx: -1 | 0 | 1; sy: -1 | 0 | 1 } => {
      if (handle === 'n') return { sx: 0, sy: -1 };
      if (handle === 's') return { sx: 0, sy: 1 };
      if (handle === 'e') return { sx: 1, sy: 0 };
      if (handle === 'w') return { sx: -1, sy: 0 };
      if (handle === 'ne') return { sx: 1, sy: -1 };
      if (handle === 'nw') return { sx: -1, sy: -1 };
      if (handle === 'se') return { sx: 1, sy: 1 };
      return { sx: -1, sy: 1 };
    };

    if (allowResize && activeResize && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const currentItems = localItemsRef.current;

      const minWidth = Math.max(100, ...currentItems.map((item) => {
        const { width: bboxW } = getBoundingBox(item.width, item.height, item.rotate);
        return item.x + item.width / 2 + bboxW / 2;
      }));
      const minHeight = Math.max(100, ...currentItems.map((item) => {
        const { height: bboxH } = getBoundingBox(item.width, item.height, item.rotate);
        return item.y + item.height / 2 + bboxH / 2;
      }));

      if (activeResize === 'right' || activeResize === 'corner') {
        const nextWidth = Math.max(minWidth, clientX - rect.left);
        if (nextWidth !== widthRef.current) {
          markTelemetryChanged();
          sizeDirtyRef.current = true;
          setWidth(nextWidth);
        }
      }
      if (activeResize === 'bottom' || activeResize === 'corner') {
        const nextHeight = Math.max(minHeight, clientY - rect.top);
        if (nextHeight !== heightRef.current) {
          markTelemetryChanged();
          sizeDirtyRef.current = true;
          setHeight(nextHeight);
        }
      }
      return;
    }

    if (activeObjectResize && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const pointerInRoom = {
        x: clamp(clientX - rect.left, 0, widthRef.current),
        y: clamp(clientY - rect.top, 0, heightRef.current),
      };
      const previousItems = localItemsRef.current;
      const targetIndex = previousItems.findIndex((item) => item.id === activeObjectResize.itemId);
      if (targetIndex < 0) return;

      const item = previousItems[targetIndex];
      const startItem = activeObjectResize.startItem;
      const centerStart = {
        x: startItem.x + startItem.width / 2,
        y: startItem.y + startItem.height / 2,
      };
      let nextItem: RoomItem | null = null;

      if ((item.type || '').trim().toLowerCase() === 'bed' && activeObjectResize.handle.length === 2) {
        const { sx, sy } = resolveHandleSigns(activeObjectResize.handle);
        const pointerLocal = worldToLocal(pointerInRoom, centerStart, startItem.rotate ?? 0);
        const startCorner = {
          x: sx * (startItem.width / 2),
          y: sy * (startItem.height / 2),
        };
        const dirLength = Math.hypot(startCorner.x, startCorner.y) || 1;
        const direction = { x: startCorner.x / dirLength, y: startCorner.y / dirLength };
        const delta = { x: pointerLocal.x - startCorner.x, y: pointerLocal.y - startCorner.y };
        const projectedDistance = delta.x * direction.x + delta.y * direction.y;
        const indexDelta = Math.round(projectedDistance / BED_PRESET_DRAG_STEP_CM);
        const nextPresetIndex = clamp(
          activeObjectResize.basePresetIndex + indexDelta,
          0,
          BED_SIZE_PRESETS.length - 1
        );
        const preset = BED_SIZE_PRESETS[nextPresetIndex];
        const nextWidth = preset.widthCm;
        const nextHeight = preset.heightCm;
        const nextX = centerStart.x - nextWidth / 2;
        const nextY = centerStart.y - nextHeight / 2;
        const bbox = getBoundingBox(nextWidth, nextHeight, item.rotate);
        const minX = (bbox.width - nextWidth) / 2;
        const maxX = widthRef.current - (nextWidth + bbox.width) / 2;
        const minY = (bbox.height - nextHeight) / 2;
        const maxY = heightRef.current - (nextHeight + bbox.height) / 2;
        const clampedX = clamp(nextX, Math.min(minX, maxX), Math.max(minX, maxX));
        const clampedY = clamp(nextY, Math.min(minY, maxY), Math.max(minY, maxY));
        nextItem = {
          ...item,
          width: nextWidth,
          height: nextHeight,
          x: clampedX,
          y: clampedY,
        };

        if (nextPresetIndex !== activeObjectResize.currentPresetIndex) {
          const updatedState = {
            ...activeObjectResize,
            currentPresetIndex: nextPresetIndex,
          };
          objectResizeStateRef.current = updatedState;
          setObjectResizeState(updatedState);
        }
        setBedPresetHint({
          name: preset.name,
          x: nextItem.x + nextItem.width / 2,
          y: nextItem.y + nextItem.height / 2,
        });
      } else {
        const { sx, sy } = resolveHandleSigns(activeObjectResize.handle);
        const pointerLocal = worldToLocal(pointerInRoom, centerStart, startItem.rotate ?? 0);
        const minSize = 20;
        const startHalfW = startItem.width / 2;
        const startHalfH = startItem.height / 2;
        let nextWidth = startItem.width;
        let nextHeight = startItem.height;
        let centerLocalX = 0;
        let centerLocalY = 0;

        if (sx !== 0) {
          const opposite = -sx * startHalfW;
          const moving = pointerLocal.x;
          const distance = Math.max(minSize, (moving - opposite) * sx);
          nextWidth = distance;
          centerLocalX = opposite + sx * (distance / 2);
        }

        if (sy !== 0) {
          const opposite = -sy * startHalfH;
          const moving = pointerLocal.y;
          const distance = Math.max(minSize, (moving - opposite) * sy);
          nextHeight = distance;
          centerLocalY = opposite + sy * (distance / 2);
        }

        const nextCenterWorld = localToWorld(
          { x: centerLocalX, y: centerLocalY },
          centerStart,
          startItem.rotate ?? 0
        );
        let nextX = nextCenterWorld.x - nextWidth / 2;
        let nextY = nextCenterWorld.y - nextHeight / 2;

        const bbox = getBoundingBox(nextWidth, nextHeight, item.rotate);
        const minX = (bbox.width - nextWidth) / 2;
        const maxX = widthRef.current - (nextWidth + bbox.width) / 2;
        const minY = (bbox.height - nextHeight) / 2;
        const maxY = heightRef.current - (nextHeight + bbox.height) / 2;
        nextX = clamp(nextX, Math.min(minX, maxX), Math.max(minX, maxX));
        nextY = clamp(nextY, Math.min(minY, maxY), Math.max(minY, maxY));
        nextItem = {
          ...item,
          width: nextWidth,
          height: nextHeight,
          x: nextX,
          y: nextY,
        };
      }

      if (!nextItem) return;
      if (
        nextItem.width === item.width &&
        nextItem.height === item.height &&
        nextItem.x === item.x &&
        nextItem.y === item.y
      ) {
        return;
      }

      markTelemetryChanged();
      const nextItems = [...previousItems];
      nextItems[targetIndex] = nextItem;
      itemsDirtyRef.current = true;
      setNextLocalItems(nextItems);
      return;
    }

    if (activeDraggingId === null || !canvasRef.current) {
      return;
    }

    const dragStartClient = dragStartClientRef.current;
    if (
      dragStartClient
      && !objectDragThresholdMetRef.current
      && !hasPointerExceededDragThreshold(
        dragStartClient,
        { x: clientX, y: clientY },
        MIN_OBJECT_DRAG_DISTANCE_CM
      )
    ) {
      return;
    }
    objectDragThresholdMetRef.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseXInCanvas = clientX - rect.left;
    const mouseYInCanvas = clientY - rect.top;
    const currentWidth = widthRef.current;
    const currentHeight = heightRef.current;
    const currentDragOffset = dragOffsetRef.current;

    const previousItems = localItemsRef.current;
    const targetIndex = previousItems.findIndex((item) => item.id === activeDraggingId);
    if (targetIndex < 0) return;

    const item = previousItems[targetIndex];
    const activeDragGroup = dragGroupStateRef.current;

    if (activeDragGroup && activeDragGroup.members.some((member) => member.id === activeDraggingId)) {
      const rawDeltaX = mouseXInCanvas - activeDragGroup.pointerStart.x;
      const rawDeltaY = mouseYInCanvas - activeDragGroup.pointerStart.y;

      let minAllowedDeltaX = Number.NEGATIVE_INFINITY;
      let maxAllowedDeltaX = Number.POSITIVE_INFINITY;
      let minAllowedDeltaY = Number.NEGATIVE_INFINITY;
      let maxAllowedDeltaY = Number.POSITIVE_INFINITY;

      activeDragGroup.members.forEach((member) => {
        const bbox = getBoundingBox(member.width, member.height, member.rotate);
        const minX = (bbox.width - member.width) / 2;
        const maxX = currentWidth - (member.width + bbox.width) / 2;
        const minY = (bbox.height - member.height) / 2;
        const maxY = currentHeight - (member.height + bbox.height) / 2;
        minAllowedDeltaX = Math.max(minAllowedDeltaX, minX - member.x);
        maxAllowedDeltaX = Math.min(maxAllowedDeltaX, maxX - member.x);
        minAllowedDeltaY = Math.max(minAllowedDeltaY, minY - member.y);
        maxAllowedDeltaY = Math.min(maxAllowedDeltaY, maxY - member.y);
      });

      const clampedDeltaX = clamp(rawDeltaX, minAllowedDeltaX, maxAllowedDeltaX);
      const clampedDeltaY = clamp(rawDeltaY, minAllowedDeltaY, maxAllowedDeltaY);

      const nextItems = [...previousItems];
      let changed = false;
      activeDragGroup.members.forEach((member) => {
        const index = previousItems.findIndex((candidate) => candidate.id === member.id);
        if (index < 0) return;
        const candidate = previousItems[index];
        const nextX = member.x + clampedDeltaX;
        const nextY = member.y + clampedDeltaY;
        if (nextX === candidate.x && nextY === candidate.y) return;
        nextItems[index] = {
          ...candidate,
          x: nextX,
          y: nextY,
        };
        changed = true;
      });

      if (!changed) return;
      markTelemetryChanged();
      itemsDirtyRef.current = true;
      setNextLocalItems(nextItems);
      return;
    }

    let nextItem = item;

    if (isOpening(item)) {
      const snapped = snapOpeningToNearestWall(item, mouseXInCanvas, mouseYInCanvas, currentWidth, currentHeight);
      if (
        snapped.x === item.x &&
        snapped.y === item.y &&
        snapped.rotate === item.rotate &&
        snapped.openingWall === item.openingWall
      ) {
        return;
      }
      nextItem = snapped;
      markTelemetryChanged();
    } else {
      const newX = mouseXInCanvas - currentDragOffset.x;
      const newY = mouseYInCanvas - currentDragOffset.y;
      const { width: bboxW, height: bboxH } = getBoundingBox(item.width, item.height, item.rotate);

      const minX = (bboxW - item.width) / 2;
      const maxX = currentWidth - (item.width + bboxW) / 2;
      const minY = (bboxH - item.height) / 2;
      const maxY = currentHeight - (item.height + bboxH) / 2;

      const clampedX = Math.max(minX, Math.min(newX, maxX));
      const clampedY = Math.max(minY, Math.min(newY, maxY));

      if (clampedX === item.x && clampedY === item.y) {
        return;
      }

      nextItem = {
        ...item,
        x: clampedX,
        y: clampedY,
      };
      markTelemetryChanged();
    }

    const nextItems = [...previousItems];
    nextItems[targetIndex] = nextItem;
    itemsDirtyRef.current = true;
    setNextLocalItems(nextItems);
  }, [allowResize, markTelemetryChanged, setNextLocalItems]);

  useEffect(() => {
    const runFrame = () => {
      rafRef.current = null;
      const latestPointer = latestPointerRef.current;
      if (!latestPointer) return;
      latestPointerRef.current = null;
      recordAppliedFrame();
      applyPointerMovement(latestPointer.clientX, latestPointer.clientY);
    };

    const scheduleFrame = (clientX: number, clientY: number) => {
      recordPointerEvent();
      latestPointerRef.current = { clientX, clientY };
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(runFrame);
    };

    const flushPointer = () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const latestPointer = latestPointerRef.current;
      latestPointerRef.current = null;
      if (latestPointer) {
        recordAppliedFrame();
        applyPointerMovement(latestPointer.clientX, latestPointer.clientY);
      }
    };

    const completePointerInteraction = (commitSelectionOnRelease: boolean) => {
      flushPointer();
      const hadResize = allowResize && isResizingRef.current !== null;
      const hadDrag = draggingIdRef.current !== null;
      const hadObjectResize = objectResizeStateRef.current !== null;
      const clickedObjectId = commitSelectionOnRelease
        && draggingIdRef.current !== null
        && !objectDragThresholdMetRef.current
          ? draggingIdRef.current
          : null;

      isResizingRef.current = null;
      draggingIdRef.current = null;
      dragGroupStateRef.current = null;
      objectResizeStateRef.current = null;
      dragStartClientRef.current = null;
      objectDragThresholdMetRef.current = false;
      activeInteractionPointerIdRef.current = null;
      setIsResizing(null);
      setDraggingId(null);
      setDragGroupState(null);
      setObjectResizeState(null);
      setBedPresetHint(null);

      if ((hadDrag || hadObjectResize) && itemsDirtyRef.current) {
        itemsDirtyRef.current = false;
        onItemsChange(localItemsRef.current.map((item) => ({ ...item })));
      }

      if (hadResize && sizeDirtyRef.current) {
        sizeDirtyRef.current = false;
        onRoomSizeChange?.(widthRef.current, heightRef.current);
      }

      if (hadDrag || hadResize || hadObjectResize) {
        onLayoutInteractionEnd?.();
      }

      if (clickedObjectId !== null) {
        onSelectMeasure?.(null);
        onSelectItems?.([clickedObjectId]);
        onEditItem(clickedObjectId);
      }
      flushTelemetrySession();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const activePointerId = activeInteractionPointerIdRef.current;
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      scheduleFrame(event.clientX, event.clientY);
    };

    const handlePointerUpOrCancel = (event: PointerEvent) => {
      const activePointerId = activeInteractionPointerIdRef.current;
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      completePointerInteraction(event.type !== 'pointercancel');
    };

    if ((allowResize && isResizing) || draggingId !== null || objectResizeState !== null) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUpOrCancel);
      window.addEventListener('pointercancel', handlePointerUpOrCancel);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUpOrCancel);
      window.removeEventListener('pointercancel', handlePointerUpOrCancel);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      latestPointerRef.current = null;
    };
  }, [
    allowResize,
    applyPointerMovement,
    draggingId,
    flushTelemetrySession,
    isResizing,
    objectResizeState,
    onEditItem,
    onItemsChange,
    onLayoutInteractionEnd,
    onRoomSizeChange,
    onSelectItems,
    onSelectMeasure,
    recordAppliedFrame,
    recordPointerEvent,
  ]);

  useEffect(() => {
    return () => {
      flushTelemetrySession();
    };
  }, [flushTelemetrySession]);

  useEffect(() => () => {
    detachBoxSelectionListeners();
    detachMeasureCreateListeners();
    detachMeasureEndpointListeners();
    detachMeasureLabelListeners();
    detachDimensionLabelListeners();
    if (measureInteractionActiveRef.current) {
      measureInteractionActiveRef.current = false;
      onLayoutInteractionEnd?.();
    }
    setMeasureSnapPreview(null);
  }, [
    detachBoxSelectionListeners,
    detachDimensionLabelListeners,
    detachMeasureCreateListeners,
    detachMeasureEndpointListeners,
    detachMeasureLabelListeners,
    onLayoutInteractionEnd,
  ]);

  const handleObjectPointerDown = (event: ReactPointerEvent, id: number) => {
    if (measureMode) return;
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    latestPointerRef.current = null;

    const item = localItemsRef.current.find((current) => current.id === id);
    if (!item || !canvasRef.current) return;
    const fallbackSelectedIds = selectedItemId === null ? [] : [selectedItemId];
    const activeSelectedIds = selectedItemIdsRef.current.length > 0 ? selectedItemIdsRef.current : fallbackSelectedIds;
    const isPartOfActiveSelection = activeSelectedIds.includes(id);

    if (!isPartOfActiveSelection || activeSelectedIds.length <= 1) {
      onSelectMeasure?.(null);
      onSelectItems?.([id]);
      onEditItem(id);
    }

    activeInteractionPointerIdRef.current = event.pointerId;
    dragStartClientRef.current = { x: event.clientX, y: event.clientY };
    objectDragThresholdMetRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);

    onLayoutInteractionStart?.();
    startTelemetrySession('drag', item.type || 'Object');
    itemsDirtyRef.current = false;
    const rect = canvasRef.current.getBoundingClientRect();
    draggingIdRef.current = id;
    setDraggingId(id);

    const groupMembers = activeSelectedIds.length > 1 && activeSelectedIds.includes(id)
      ? localItemsRef.current
        .filter((candidate) => activeSelectedIds.includes(candidate.id))
        .filter((candidate) => !isOpening(candidate))
        .map((candidate) => ({
          id: candidate.id,
          x: candidate.x,
          y: candidate.y,
          width: candidate.width,
          height: candidate.height,
          rotate: candidate.rotate,
        }))
      : [];

    if (groupMembers.length > 1) {
      const groupState: DragGroupState = {
        pointerStart: {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
        members: groupMembers,
      };
      dragGroupStateRef.current = groupState;
      setDragGroupState(groupState);
    } else {
      dragGroupStateRef.current = null;
      setDragGroupState(null);
    }

    const mouseXInCanvas = event.clientX - rect.left;
    const mouseYInCanvas = event.clientY - rect.top;
    if (isOpening(item)) {
      const nextOffset = { x: item.width / 2, y: item.height / 2 };
      setDragOffset(nextOffset);
      dragOffsetRef.current = nextOffset;
      return;
    }

    const nextOffset = {
      x: mouseXInCanvas - item.x,
      y: mouseYInCanvas - item.y,
    };
    setDragOffset(nextOffset);
    dragOffsetRef.current = nextOffset;
  };

  const beginBoxSelection = (event: ReactPointerEvent) => {
    if (measureMode || isExportingPdf || !canvasRef.current) return;
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target !== event.currentTarget) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    const start = toPointInRoom(event.clientX, event.clientY, rect, widthRef.current, heightRef.current);
    let latest = start;

    boxSelectionPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionDraft({ start, end: start });
    onSelectMeasure?.(null);
    detachBoxSelectionListeners();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== boxSelectionPointerIdRef.current) return;
      latest = toPointInRoom(moveEvent.clientX, moveEvent.clientY, rect, widthRef.current, heightRef.current);
      setSelectionDraft({ start, end: latest });
    };

    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== boxSelectionPointerIdRef.current) return;
      setSelectionDraft(null);
      detachBoxSelectionListeners();

      if (getSelectionDragDistance(start, latest) < MIN_BOX_SELECTION_DRAG_CM) {
        // Pointerdown prevents the native click path; treat tiny drags as blank-click deselect.
        onSelectItems?.([]);
        onEditItem(null);
        onSelectMeasure?.(null);
        return;
      }

      const selection = createSelectionBounds(start, latest);
      const size = getSelectionSize(selection);
      if (size.width <= 0 && size.height <= 0) {
        onSelectItems?.([]);
        onEditItem(null);
        onSelectMeasure?.(null);
        return;
      }

      const selectedIds = getSelectableItemIds(localItemsRef.current, selection, {
        includeItem: (candidate) => !isOpening(candidate),
      });

      onSelectItems?.(selectedIds);
      onEditItem(selectedIds.length === 1 ? selectedIds[0] : null);
      onSelectMeasure?.(null);
    };

    boxSelectionHandlersRef.current = { onMove: handlePointerMove, onUp: finish };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const updateMeasureSnapPreview = useCallback((anchor: Point, result: MeasureConstraintResult) => {
    const snapped: Point[] = [];
    if (result.snappedX || result.snappedY) {
      snapTargets.forEach((target) => {
        const xMatch = !result.snappedX || Math.abs(target.x - result.point.x) <= 0.5;
        const yMatch = !result.snappedY || Math.abs(target.y - result.point.y) <= 0.5;
        if (xMatch && yMatch) {
          snapped.push(target);
        }
      });
      if (snapped.length === 0) {
        snapped.push({ ...result.point });
      }
    }
    setMeasureSnapPreview({
      anchor,
      point: result.point,
      snapped,
    });
  }, [snapTargets]);

  const beginMeasureCreate = (
    event: ReactPointerEvent,
    startFromAnchor?: Point,
    wallSourceKey?: string
  ) => {
    if (!measureMode || !onMeasuresChange || !canvasRef.current || isExportingPdf) {
      return;
    }

    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    measureCreatePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveWallMeasureKey(wallSourceKey ?? null);
    const startRaw = startFromAnchor ?? toPointInRoom(event.clientX, event.clientY, rect, widthRef.current, heightRef.current);
    const startResult = applyMeasureConstraint(
      startRaw,
      startRaw,
      event.shiftKey,
      snapTargets,
      widthRef.current,
      heightRef.current,
      MEASURE_SNAP_THRESHOLD_CM
    );
    const start = startResult.point;

    detachMeasureCreateListeners();
    measureInteractionActiveRef.current = true;
    onLayoutInteractionStart?.();
    onSelectItems?.([]);
    onEditItem(null);
    onSelectMeasure?.(null);
    updateMeasureSnapPreview(start, startResult);

    setDraftMeasure({
      id: -1,
      x1: start.x,
      y1: start.y,
      x2: start.x,
      y2: start.y,
      includeInPdf: false,
      labelT: 0.5,
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== measureCreatePointerIdRef.current) return;
      const raw = toPointInRoom(moveEvent.clientX, moveEvent.clientY, rect, widthRef.current, heightRef.current);
      const constrained = applyMeasureConstraint(
        raw,
        start,
        moveEvent.shiftKey,
        snapTargets,
        widthRef.current,
        heightRef.current,
        MEASURE_SNAP_THRESHOLD_CM
      );
      updateMeasureSnapPreview(start, constrained);
      setDraftMeasure((prev) => (
        prev
          ? { ...prev, x2: constrained.point.x, y2: constrained.point.y }
          : prev
      ));
    };

    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== measureCreatePointerIdRef.current) return;
      const raw = toPointInRoom(upEvent.clientX, upEvent.clientY, rect, widthRef.current, heightRef.current);
      const constrained = applyMeasureConstraint(
        raw,
        start,
        upEvent.shiftKey,
        snapTargets,
        widthRef.current,
        heightRef.current,
        MEASURE_SNAP_THRESHOLD_CM
      );
      const nextMeasure: Omit<MeasureLine, 'id'> = {
        x1: start.x,
        y1: start.y,
        x2: constrained.point.x,
        y2: constrained.point.y,
        includeInPdf: false,
        labelT: 0.5,
      };

      if (distanceBetween({ x: nextMeasure.x1, y: nextMeasure.y1 }, { x: nextMeasure.x2, y: nextMeasure.y2 }) >= MIN_MEASURE_LENGTH_CM) {
        const nextId = getNextMeasureId(localMeasuresRef.current);
        const nextMeasures = [...localMeasuresRef.current, { ...nextMeasure, id: nextId }];
        setNextLocalMeasures(nextMeasures);
        onMeasuresChange(nextMeasures.map((measure) => ({ ...measure })));
        onSelectMeasure?.(nextId);
        onMeasureCreated?.(nextId);
      }

      setDraftMeasure(null);
      setMeasureSnapPreview(null);
      setActiveWallMeasureKey(null);
      if (measureInteractionActiveRef.current) {
        measureInteractionActiveRef.current = false;
        onLayoutInteractionEnd?.();
      }
      detachMeasureCreateListeners();
    };

    measureCreateHandlersRef.current = { onMove: handlePointerMove, onUp: finish };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent) => {
    if (measureMode) {
      beginMeasureCreate(event);
      return;
    }
    beginBoxSelection(event);
  };

  const beginMeasureFromWallTarget = (event: ReactPointerEvent, target: WallSegment) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point = toPointInRoom(event.clientX, event.clientY, rect, widthRef.current, heightRef.current);

    let interiorAnchor: Point;
    if (target.wall === 'top') {
      interiorAnchor = { x: clamp(point.x, target.start, target.end), y: 0 };
    } else if (target.wall === 'bottom') {
      interiorAnchor = { x: clamp(point.x, target.start, target.end), y: heightRef.current };
    } else if (target.wall === 'left') {
      interiorAnchor = { x: 0, y: clamp(point.y, target.start, target.end) };
    } else {
      interiorAnchor = { x: widthRef.current, y: clamp(point.y, target.start, target.end) };
    }

    beginMeasureCreate(event, interiorAnchor, target.key);
  };

  const beginMeasureEndpointDrag = (
    event: ReactPointerEvent,
    measure: MeasureLine,
    endpoint: 'start' | 'end'
  ) => {
    if (!measureMode || !onMeasuresChange || !canvasRef.current || isExportingPdf) return;
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    measureEndpointPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const anchor = endpoint === 'start'
      ? { x: measure.x2, y: measure.y2 }
      : { x: measure.x1, y: measure.y1 };

    detachMeasureEndpointListeners();
    activeMeasureDragRef.current = true;
    measureInteractionActiveRef.current = true;
    measuresDirtyRef.current = false;
    onLayoutInteractionStart?.();
    onSelectItems?.([]);
    onEditItem(null);
    onSelectMeasure?.(measure.id);
    setMeasureSnapPreview({
      anchor,
      point: endpoint === 'start' ? { x: measure.x1, y: measure.y1 } : { x: measure.x2, y: measure.y2 },
      snapped: [],
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== measureEndpointPointerIdRef.current) return;
      const raw = toPointInRoom(moveEvent.clientX, moveEvent.clientY, rect, widthRef.current, heightRef.current);
      const constrained = applyMeasureConstraint(
        raw,
        anchor,
        moveEvent.shiftKey,
        snapTargets,
        widthRef.current,
        heightRef.current,
        MEASURE_SNAP_THRESHOLD_CM
      );
      updateMeasureSnapPreview(anchor, constrained);

      const nextMeasures = localMeasuresRef.current.map((candidate) => {
        if (candidate.id !== measure.id) return candidate;
        return endpoint === 'start'
          ? { ...candidate, x1: constrained.point.x, y1: constrained.point.y }
          : { ...candidate, x2: constrained.point.x, y2: constrained.point.y };
      });
      measuresDirtyRef.current = true;
      setNextLocalMeasures(nextMeasures);
    };

    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== measureEndpointPointerIdRef.current) return;
      if (measuresDirtyRef.current) {
        measuresDirtyRef.current = false;
        onMeasuresChange(localMeasuresRef.current.map((candidate) => ({ ...candidate })));
      }
      activeMeasureDragRef.current = false;
      if (measureInteractionActiveRef.current) {
        measureInteractionActiveRef.current = false;
        onLayoutInteractionEnd?.();
      }
      setMeasureSnapPreview(null);
      detachMeasureEndpointListeners();
    };

    measureEndpointHandlersRef.current = { onMove: handlePointerMove, onUp: finish };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const beginMeasureLabelDrag = (event: ReactPointerEvent, measure: MeasureLine) => {
    if (!measureMode || !onMeasuresChange || !canvasRef.current || isExportingPdf) return;
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    measureLabelPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    detachMeasureLabelListeners();
    activeMeasureDragRef.current = true;
    measureInteractionActiveRef.current = true;
    measuresDirtyRef.current = false;
    onLayoutInteractionStart?.();
    onSelectItems?.([]);
    onEditItem(null);
    onSelectMeasure?.(measure.id);

    const start = { x: measure.x1, y: measure.y1 };
    const end = { x: measure.x2, y: measure.y2 };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== measureLabelPointerIdRef.current) return;
      const point = toPointInRoom(moveEvent.clientX, moveEvent.clientY, rect, widthRef.current, heightRef.current);
      const labelT = projectPointToSegmentT(point, start, end);
      const nextMeasures = localMeasuresRef.current.map((candidate) => (
        candidate.id === measure.id ? { ...candidate, labelT } : candidate
      ));
      measuresDirtyRef.current = true;
      setNextLocalMeasures(nextMeasures);
    };

    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== measureLabelPointerIdRef.current) return;
      if (measuresDirtyRef.current) {
        measuresDirtyRef.current = false;
        onMeasuresChange(localMeasuresRef.current.map((candidate) => ({ ...candidate })));
      }
      activeMeasureDragRef.current = false;
      if (measureInteractionActiveRef.current) {
        measureInteractionActiveRef.current = false;
        onLayoutInteractionEnd?.();
      }
      detachMeasureLabelListeners();
    };

    measureLabelHandlersRef.current = { onMove: handlePointerMove, onUp: finish };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const beginDimensionLabelDrag = (
    event: ReactPointerEvent,
    axis: 'width' | 'height'
  ) => {
    if (!onDimensionLabelLayoutChange || isExportingPdf || !canvasRef.current) return;
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    dimensionLabelPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startLayout = localDimensionLabelLayoutRef.current;

    detachDimensionLabelListeners();
    onLayoutInteractionStart?.();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== dimensionLabelPointerIdRef.current) return;
      const point = toPointInRoom(moveEvent.clientX, moveEvent.clientY, rect, widthRef.current, heightRef.current);
      const next = axis === 'width'
        ? { ...startLayout, widthLabelT: clamp(point.x / widthRef.current, 0, 1) }
        : { ...startLayout, heightLabelT: clamp(point.y / heightRef.current, 0, 1) };
      setNextDimensionLabelLayout(next);
    };

    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== dimensionLabelPointerIdRef.current) return;
      onDimensionLabelLayoutChange(localDimensionLabelLayoutRef.current);
      onLayoutInteractionEnd?.();
      detachDimensionLabelListeners();
    };

    dimensionLabelHandlersRef.current = { onMove: handlePointerMove, onUp: finish };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const beginObjectResize = (event: ReactPointerEvent, handle: ObjectResizeState['handle']) => {
    if (measureMode || !selectedItemId || !canvasRef.current) return;
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const item = localItemsRef.current.find((candidate) => candidate.id === selectedItemId);
    if (!item || isOpening(item)) return;
    const normalizedType = (item.type || '').trim().toLowerCase();
    const isBed = normalizedType === 'bed';
    if (isBed && (handle === 'n' || handle === 's' || handle === 'e' || handle === 'w')) return;

    activeInteractionPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    onLayoutInteractionStart?.();
    startTelemetrySession('resize', item.type || 'Object');
    latestPointerRef.current = null;
    itemsDirtyRef.current = false;
    const resizeState: ObjectResizeState = {
      itemId: item.id,
      handle,
      startItem: { ...item },
      basePresetIndex: getBedPresetIndex(item),
      currentPresetIndex: getBedPresetIndex(item),
    };
    objectResizeStateRef.current = resizeState;
    setObjectResizeState(resizeState);
  };

  const displayedMeasures = useMemo(() => {
    if (!isExportingPdf) return localMeasures;
    return localMeasures.filter((measure) => measure.includeInPdf);
  }, [isExportingPdf, localMeasures]);

  const effectiveSelectedItemIds = useMemo(() => {
    if (selectedItemIds.length > 0) {
      return Array.from(new Set(selectedItemIds));
    }
    return selectedItemId === null ? [] : [selectedItemId];
  }, [selectedItemId, selectedItemIds]);

  const selectedItemIdSet = useMemo(() => new Set(effectiveSelectedItemIds), [effectiveSelectedItemIds]);

  const openingLabels = useMemo(
    () => localItems
      .filter((item) => item.type === 'Door' || item.type === 'Window')
      .map((item) => {
        const isWindow = item.type === 'Window';
        const isDoor = item.type === 'Door';
        const isOpeningLabel = isWindow || isDoor;
        const wall = resolveOpeningWall(item);
        const doorOffset = isDoor ? getDoorWallCenterOffset(wall, wallThicknessCm) : { x: 0, y: 0 };
        const rawX = item.x + item.width / 2 + doorOffset.x;
        const rawY = item.y + item.height / 2 + doorOffset.y;
        const labelOutset = item.height / 2 + (isWindow ? WINDOW_LABEL_OUTSET_CM : DOOR_LABEL_OUTSET_CM);
        const sideLabelOutset = labelOutset + (isWindow ? WINDOW_SIDE_LABEL_EXTRA_CM : DOOR_SIDE_LABEL_EXTRA_CM);

        let labelX = clamp(rawX, 44, width - 44);
        let labelY = clamp(rawY, 20, height - 20);

        if (isOpeningLabel) {
          if (wall === 'top') {
            labelY = rawY - labelOutset;
            labelX = clamp(rawX, 44, width - 44);
          } else if (wall === 'bottom') {
            labelY = rawY + labelOutset;
            labelX = clamp(rawX, 44, width - 44);
          } else if (wall === 'left') {
            labelX = rawX - sideLabelOutset;
            labelY = clamp(rawY, 20, height - 20);
          } else {
            labelX = rawX + sideLabelOutset;
            labelY = clamp(rawY, 20, height - 20);
          }
        }

        return {
          id: item.id,
          label: item.type || 'Opening',
          x: labelX,
          y: labelY,
          selected: selectedItemIdSet.has(item.id),
          isDoor,
        };
      }),
    [height, localItems, selectedItemIdSet, wallThicknessCm, width]
  );

  const wallSegments = useMemo<WallSegment[]>(() => {
    const cutouts: Record<'top' | 'right' | 'bottom' | 'left', Array<{ start: number; end: number }>> = {
      top: [],
      right: [],
      bottom: [],
      left: [],
    };

    localItems.forEach((item) => {
      if (!isOpening(item)) return;
      const wall = resolveOpeningWall(item);
      if (wall === 'top' || wall === 'bottom') {
        const center = item.x + item.width / 2;
        const halfSpan = item.width / 2;
        cutouts[wall].push({ start: center - halfSpan, end: center + halfSpan });
      } else {
        const center = item.y + item.height / 2;
        const halfSpan = item.width / 2;
        cutouts[wall].push({ start: center - halfSpan, end: center + halfSpan });
      }
    });

    const halfThickness = wallThicknessCm / 2;

    const top = subtractIntervals(width, cutouts.top).map((segment, index) => ({
      key: `top-${index}`,
      wall: 'top' as const,
      start: segment.start,
      end: segment.end,
      x: segment.start,
      y: -wallThicknessCm,
      width: segment.end - segment.start,
      height: wallThicknessCm,
      centerlineStart: { x: segment.start, y: -halfThickness },
      centerlineEnd: { x: segment.end, y: -halfThickness },
    }));
    const bottom = subtractIntervals(width, cutouts.bottom).map((segment, index) => ({
      key: `bottom-${index}`,
      wall: 'bottom' as const,
      start: segment.start,
      end: segment.end,
      x: segment.start,
      y: height,
      width: segment.end - segment.start,
      height: wallThicknessCm,
      centerlineStart: { x: segment.start, y: height + halfThickness },
      centerlineEnd: { x: segment.end, y: height + halfThickness },
    }));
    const left = subtractIntervals(height, cutouts.left).map((segment, index) => ({
      key: `left-${index}`,
      wall: 'left' as const,
      start: segment.start,
      end: segment.end,
      x: -wallThicknessCm,
      y: segment.start,
      width: wallThicknessCm,
      height: segment.end - segment.start,
      centerlineStart: { x: -halfThickness, y: segment.start },
      centerlineEnd: { x: -halfThickness, y: segment.end },
    }));
    const right = subtractIntervals(height, cutouts.right).map((segment, index) => ({
      key: `right-${index}`,
      wall: 'right' as const,
      start: segment.start,
      end: segment.end,
      x: width,
      y: segment.start,
      width: wallThicknessCm,
      height: segment.end - segment.start,
      centerlineStart: { x: width + halfThickness, y: segment.start },
      centerlineEnd: { x: width + halfThickness, y: segment.end },
    }));

    return [...top, ...bottom, ...left, ...right];
  }, [height, localItems, wallThicknessCm, width]);

  const wallMeasureTargets = useMemo(() => {
    if (!measureMode || isExportingPdf) return [];
    return wallSegments
      .filter((segment) => segment.end - segment.start >= MIN_WALL_MEASURE_TARGET_LENGTH_CM)
      .map((segment) => ({
        ...segment,
        midpoint: {
          x: (segment.centerlineStart.x + segment.centerlineEnd.x) / 2,
          y: (segment.centerlineStart.y + segment.centerlineEnd.y) / 2,
        },
        guideStrokeWidth: Math.max(2.2, wallThicknessCm * 0.24),
        emphasisStrokeWidth: Math.max(6, wallThicknessCm * 0.62),
        hitStrokeWidth: Math.max(18, wallThicknessCm * 1.65),
      }));
  }, [isExportingPdf, measureMode, wallSegments, wallThicknessCm]);

  const roomDimensionLabelPositions = useMemo(() => {
    const widthT = localDimensionLabelLayout.widthLabelT;
    const heightT = localDimensionLabelLayout.heightLabelT;
    return {
      width: {
        x: clamp(width * widthT, 30, width - 30),
        y: -(wallThicknessCm + DIMENSION_LABEL_OFFSET_CM),
      },
      height: {
        x: -(wallThicknessCm + DIMENSION_LABEL_OFFSET_CM),
        y: clamp(height * heightT, 30, height - 30),
      },
    };
  }, [height, localDimensionLabelLayout.heightLabelT, localDimensionLabelLayout.widthLabelT, wallThicknessCm, width]);

  const canvasStyle = useMemo(() => {
    const minorGridSizePx = Math.max(2, gridSpacingCm);
    const baseStyle = {
      width,
      height,
      touchAction: measureMode ? 'none' : 'auto',
      '--grid-size': `${minorGridSizePx.toFixed(2)}px`,
      '--grid-color': gridColor ?? 'var(--grid-line-color)',
    } as CSSProperties & Record<'--grid-size' | '--grid-color', string>;

    if (!isExportingPdf) {
      return baseStyle;
    }

    const minorGridStep = Math.max(8, Math.round(minorGridSizePx));
    const majorGridStep = minorGridStep * 5;

    return {
      ...baseStyle,
      backgroundColor: '#eef3f8',
      backgroundImage: [
        'linear-gradient(to right, rgba(30, 41, 59, 0.16) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(30, 41, 59, 0.16) 1px, transparent 1px)',
        'linear-gradient(to right, rgba(15, 23, 42, 0.28) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(15, 23, 42, 0.28) 1px, transparent 1px)',
        'radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.4), rgba(148, 163, 184, 0.14) 78%, rgba(51, 65, 85, 0.16))',
      ].join(', '),
      backgroundSize: [
        `${minorGridStep}px ${minorGridStep}px`,
        `${minorGridStep}px ${minorGridStep}px`,
        `${majorGridStep}px ${majorGridStep}px`,
        `${majorGridStep}px ${majorGridStep}px`,
        '100% 100%',
      ].join(', '),
      borderColor: '#b6c2cf',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.85), inset 0 -14px 24px -20px rgba(15, 23, 42, 0.28)',
    };
  }, [gridColor, gridSpacingCm, height, isExportingPdf, measureMode, width]);

  const displayWidth = fromBaseCm(width, unit);
  const displayHeight = fromBaseCm(height, unit);
  const showMeasureHandles = measureMode && !isExportingPdf;
  const canvasPadding = (isExportingPdf ? EXPORT_CANVAS_PADDING_PX : CANVAS_PADDING_PX) + wallThicknessCm + WALL_PADDING_CM;
  const canvasClassName = `room-canvas-surface relative rounded-xl shadow-sm overflow-visible ${
    isExportingPdf ? 'room-canvas-export-floor' : 'bg-grid'
  }`;
  const selectionBoxFrame = useMemo(() => {
    if (!selectionDraft || measureMode || isExportingPdf) return null;
    const bounds = createSelectionBounds(selectionDraft.start, selectionDraft.end);
    const size = getSelectionSize(bounds);
    return {
      left: bounds.left,
      top: bounds.top,
      width: size.width,
      height: size.height,
    };
  }, [isExportingPdf, measureMode, selectionDraft]);

  const selectedResizableItem = useMemo(() => {
    if (measureMode || effectiveSelectedItemIds.length !== 1) return null;
    const candidate = localItems.find((item) => item.id === effectiveSelectedItemIds[0]) ?? null;
    if (!candidate || isOpening(candidate)) return null;
    return candidate;
  }, [effectiveSelectedItemIds, localItems, measureMode]);

  const selectedResizeHandles = useMemo(() => {
    if (!selectedResizableItem) return [];
    const normalizedType = (selectedResizableItem.type || '').trim().toLowerCase();
    const isBed = normalizedType === 'bed';
    const corners = getRotatedCorners(selectedResizableItem);
    const mids = getRotatedMidpoints(selectedResizableItem);
    const handles: Array<{ handle: ObjectResizeState['handle']; point: Point; cursor: string }> = [
      { handle: 'nw', point: corners[0], cursor: 'nwse-resize' },
      { handle: 'ne', point: corners[1], cursor: 'nesw-resize' },
      { handle: 'se', point: corners[2], cursor: 'nwse-resize' },
      { handle: 'sw', point: corners[3], cursor: 'nesw-resize' },
    ];
    if (!isBed) {
      handles.push(
        { handle: 'n', point: mids[0], cursor: 'ns-resize' },
        { handle: 'e', point: mids[1], cursor: 'ew-resize' },
        { handle: 's', point: mids[2], cursor: 'ns-resize' },
        { handle: 'w', point: mids[3], cursor: 'ew-resize' },
      );
    }
    return handles;
  }, [selectedResizableItem]);

  return (
    <div className="workspace-card">
      <div className="workspace-scroll">
        <div
          className="mx-auto w-fit"
          style={{ padding: canvasPadding }}
          data-floorplan-export-room={exportRoomId}
          data-floorplan-export={exportRoomId ? 'true' : undefined}
        >
          <div
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            className={canvasClassName}
            style={canvasStyle}
          >
            <div
              className={`room-canvas-size-chip absolute z-30 -translate-x-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 rounded-md border shadow-sm select-none ${
                isExportingPdf ? 'pointer-events-none' : 'cursor-ew-resize'
              }`}
              style={{ left: roomDimensionLabelPositions.width.x, top: roomDimensionLabelPositions.width.y }}
              onPointerDown={(event) => beginDimensionLabelDrag(event, 'width')}
            >
              {Math.round(displayWidth * 100) / 100}{unit}
            </div>
            <div
              className={`room-canvas-size-chip absolute z-30 -translate-x-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 rounded-md border shadow-sm select-none origin-center -rotate-90 ${
                isExportingPdf ? 'pointer-events-none' : 'cursor-ns-resize'
              }`}
              style={{ left: roomDimensionLabelPositions.height.x, top: roomDimensionLabelPositions.height.y }}
              onPointerDown={(event) => beginDimensionLabelDrag(event, 'height')}
            >
              {Math.round(displayHeight * 100) / 100}{unit}
            </div>

            <svg className="absolute inset-0 z-[1] h-full w-full overflow-visible pointer-events-none">
              {wallSegments.map((segment) => (
                <rect
                  key={`wall-${segment.key}`}
                  x={segment.x}
                  y={segment.y}
                  width={segment.width}
                  height={segment.height}
                  fill={isExportingPdf ? '#d7dee7' : 'var(--room-wall-fill)'}
                  stroke={isExportingPdf ? '#97a7b8' : 'var(--room-wall-stroke)'}
                  strokeWidth={1}
                />
              ))}
            </svg>

            {selectionBoxFrame && (
              <div
                className="absolute z-[2] pointer-events-none border"
                style={{
                  left: selectionBoxFrame.left,
                  top: selectionBoxFrame.top,
                  width: selectionBoxFrame.width,
                  height: selectionBoxFrame.height,
                  borderColor: 'var(--measure-line-selected)',
                  backgroundColor: 'color-mix(in srgb, var(--measure-line-selected) 16%, transparent)',
                }}
              />
            )}

            {localItems.map((item) => {
              const wall = resolveOpeningWall(item);
              const doorOffset = item.type === 'Door' ? getDoorWallCenterOffset(wall, wallThicknessCm) : { x: 0, y: 0 };
              return (
                <RoomObject
                  key={item.id}
                  width={item.width}
                  height={item.height}
                  x={item.x + doorOffset.x}
                  y={item.y + doorOffset.y}
                  rotate={item.rotate}
                  label={item.type}
                  type={item.type}
                  doorOpenDirection={item.doorOpenDirection}
                  doorOpenSide={item.doorOpenSide}
                  openingWall={item.openingWall}
                  isSelected={selectedItemIdSet.has(item.id)}
                  showLabel={item.type !== 'Door' && item.type !== 'Window'}
                  bulgeOutward={item.type === 'Window'}
                  onPointerDown={(event) => handleObjectPointerDown(event, item.id)}
                />
              );
            })}

            {openingLabels.map((label) => (
              <div
                key={`opening-label-${label.id}`}
                className={`room-opening-chip absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border shadow-sm ${
                  label.isDoor ? 'room-opening-chip-door' : 'room-opening-chip-window'
                } ${label.selected ? 'room-opening-chip-selected' : ''}`}
                style={{ left: label.x, top: label.y }}
              >
                {label.label}
              </div>
            ))}

            <svg className="absolute inset-0 z-20 h-full w-full pointer-events-none">
              {measureMode && !isExportingPdf && wallMeasureTargets.map((target) => {
                const isHovered = hoveredWallMeasureKey === target.key;
                const isActive = activeWallMeasureKey === target.key;
                const stroke = isActive
                  ? 'var(--wall-measure-target-active)'
                  : isHovered
                    ? 'var(--wall-measure-target-hover)'
                    : 'var(--wall-measure-target-stroke)';

                return (
                  <g key={`wall-measure-target-${target.key}`}>
                    <line
                      x1={target.centerlineStart.x}
                      y1={target.centerlineStart.y}
                      x2={target.centerlineEnd.x}
                      y2={target.centerlineEnd.y}
                      stroke="var(--wall-measure-target-zone)"
                      strokeWidth={target.emphasisStrokeWidth}
                      strokeLinecap="round"
                    />
                    <line
                      x1={target.centerlineStart.x}
                      y1={target.centerlineStart.y}
                      x2={target.centerlineEnd.x}
                      y2={target.centerlineEnd.y}
                      stroke={stroke}
                      strokeWidth={target.guideStrokeWidth}
                      strokeDasharray="6 4"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={target.midpoint.x}
                      cy={target.midpoint.y}
                      r={isHovered || isActive ? 4.5 : 3.8}
                      fill="var(--wall-measure-target-node-fill)"
                      stroke={stroke}
                      strokeWidth={1.3}
                    />
                    <line
                      x1={target.centerlineStart.x}
                      y1={target.centerlineStart.y}
                      x2={target.centerlineEnd.x}
                      y2={target.centerlineEnd.y}
                      stroke="transparent"
                      strokeWidth={target.hitStrokeWidth}
                      className="cursor-crosshair pointer-events-auto"
                      onPointerEnter={() => setHoveredWallMeasureKey(target.key)}
                      onPointerLeave={() => setHoveredWallMeasureKey((current) => (current === target.key ? null : current))}
                      onPointerDown={(event) => beginMeasureFromWallTarget(event, target)}
                    />
                  </g>
                );
              })}

              {measureMode && !isExportingPdf && measureTargetGeometry.map((target) => (
                <g key={`measure-target-${target.itemId}`}>
                  <polygon
                    points={target.polygon}
                    fill="transparent"
                    stroke={hoveredMeasureAnchorKey?.startsWith(`${target.itemId}-`) ? 'var(--measure-line-selected)' : 'var(--measure-target-stroke)'}
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                    className="pointer-events-auto"
                    onPointerEnter={() => setHoveredMeasureAnchorKey(`${target.itemId}-rect`)}
                    onPointerLeave={() => setHoveredMeasureAnchorKey((current) => (current === `${target.itemId}-rect` ? null : current))}
                  />
                  {target.anchors.map((anchor) => (
                    <circle
                      key={`measure-target-anchor-${anchor.key}`}
                      cx={anchor.point.x}
                      cy={anchor.point.y}
                      r={4}
                      fill={hoveredMeasureAnchorKey === anchor.key ? 'var(--measure-line-selected)' : 'var(--measure-target-anchor)'}
                      className="cursor-crosshair pointer-events-auto"
                      onPointerEnter={() => setHoveredMeasureAnchorKey(anchor.key)}
                      onPointerLeave={() => setHoveredMeasureAnchorKey((current) => (current === anchor.key ? null : current))}
                      onPointerDown={(event) => beginMeasureCreate(event, anchor.point)}
                    />
                  ))}
                </g>
              ))}

              {measureSnapPreview && !isExportingPdf && (
                <g>
                  <line
                    x1={measureSnapPreview.anchor.x}
                    y1={measureSnapPreview.anchor.y}
                    x2={measureSnapPreview.point.x}
                    y2={measureSnapPreview.point.y}
                    stroke="var(--measure-draft-line)"
                    strokeWidth={1.3}
                    strokeDasharray="3 3"
                  />
                  {Math.abs(measureSnapPreview.anchor.x - measureSnapPreview.point.x) < 0.25 && (
                    <line
                      x1={measureSnapPreview.point.x}
                      y1={0}
                      x2={measureSnapPreview.point.x}
                      y2={height}
                      stroke="var(--measure-guide-line)"
                      strokeWidth={1}
                      strokeDasharray="2 4"
                    />
                  )}
                  {Math.abs(measureSnapPreview.anchor.y - measureSnapPreview.point.y) < 0.25 && (
                    <line
                      x1={0}
                      y1={measureSnapPreview.point.y}
                      x2={width}
                      y2={measureSnapPreview.point.y}
                      stroke="var(--measure-guide-line)"
                      strokeWidth={1}
                      strokeDasharray="2 4"
                    />
                  )}
                  {measureSnapPreview.snapped.map((point, index) => (
                    <circle
                      key={`measure-snapped-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={3.5}
                      fill="var(--measure-line-selected)"
                    />
                  ))}
                </g>
              )}

              {displayedMeasures.map((measure) => {
                const dx = measure.x2 - measure.x1;
                const dy = measure.y2 - measure.y1;
                const lengthCm = Math.hypot(dx, dy);
                const lengthLabel = `${Number(fromBaseCm(lengthCm, unit).toFixed(unit === 'm' || unit === 'ft' ? 2 : 1))}${unit}`;
                const selected = selectedMeasureId === measure.id;
                const labelT = clamp(measure.labelT ?? 0.5, 0, 1);
                const labelPoint = {
                  x: measure.x1 + dx * labelT,
                  y: measure.y1 + dy * labelT,
                };
                const labelX = clamp(labelPoint.x, 22, width - 22);
                const labelY = clamp(labelPoint.y - 6, 12, height - 6);
                const defaultLineColor = isExportingPdf ? '#0f172a' : 'var(--measure-line)';
                const selectedLineColor = isExportingPdf ? '#1d4ed8' : 'var(--measure-line-selected)';
                const labelColor = isExportingPdf ? '#334155' : 'var(--measure-label)';
                const labelHalo = isExportingPdf ? '#ffffff' : 'var(--canvas-bg)';

                return (
                  <g key={`measure-${measure.id}`}>
                    <line
                      x1={measure.x1}
                      y1={measure.y1}
                      x2={measure.x2}
                      y2={measure.y2}
                      stroke={selected ? selectedLineColor : defaultLineColor}
                      strokeWidth={selected ? 2.2 : 1.8}
                      strokeDasharray={measure.includeInPdf ? '0' : '5 3'}
                      className={isExportingPdf ? '' : 'cursor-pointer pointer-events-auto'}
                      onPointerDown={(event) => {
                        if (isExportingPdf) return;
                        if (!event.isPrimary) return;
                        if (event.pointerType === 'mouse' && event.button !== 0) return;
                        event.stopPropagation();
                        event.preventDefault();
                        onSelectItems?.([]);
                        onEditItem(null);
                        onSelectMeasure?.(measure.id);
                      }}
                      onClick={(event) => {
                        if (isExportingPdf) return;
                        event.stopPropagation();
                      }}
                    />
                    {!isExportingPdf && (
                      <line
                        x1={measure.x1}
                        y1={measure.y1}
                        x2={measure.x2}
                        y2={measure.y2}
                        stroke="transparent"
                        strokeWidth={12}
                        className="cursor-pointer pointer-events-auto"
                        onPointerDown={(event) => {
                          if (!event.isPrimary) return;
                          if (event.pointerType === 'mouse' && event.button !== 0) return;
                          event.stopPropagation();
                          event.preventDefault();
                          onSelectItems?.([]);
                          onEditItem(null);
                          onSelectMeasure?.(measure.id);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      />
                    )}
                    <text
                      x={labelX}
                      y={labelY}
                      fontSize="10"
                      fill={selected ? selectedLineColor : labelColor}
                      stroke={labelHalo}
                      strokeWidth="3"
                      paintOrder="stroke fill"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      textAnchor="middle"
                      className={measureMode && !isExportingPdf ? 'cursor-grab pointer-events-auto select-none' : 'pointer-events-none select-none'}
                      onPointerDown={(event) => beginMeasureLabelDrag(event, measure)}
                    >
                      {lengthLabel}
                    </text>
                    {showMeasureHandles && (
                      <>
                        <circle
                          cx={measure.x1}
                          cy={measure.y1}
                          r={4.5}
                          fill={selected ? 'var(--measure-line-selected)' : 'var(--measure-handle)'}
                          className="cursor-grab pointer-events-auto"
                          onPointerDown={(event) => beginMeasureEndpointDrag(event, measure, 'start')}
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        />
                        <circle
                          cx={measure.x2}
                          cy={measure.y2}
                          r={4.5}
                          fill={selected ? 'var(--measure-line-selected)' : 'var(--measure-handle)'}
                          className="cursor-grab pointer-events-auto"
                          onPointerDown={(event) => beginMeasureEndpointDrag(event, measure, 'end')}
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        />
                      </>
                    )}
                  </g>
                );
              })}

              {!isExportingPdf && draftMeasure && (
                <line
                  x1={draftMeasure.x1}
                  y1={draftMeasure.y1}
                  x2={draftMeasure.x2}
                  y2={draftMeasure.y2}
                  stroke="var(--measure-draft-line)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              )}

              {!measureMode && !isExportingPdf && selectedResizeHandles.map((handle) => (
                <circle
                  key={`resize-handle-${handle.handle}`}
                  cx={handle.point.x}
                  cy={handle.point.y}
                  r={4.8}
                  fill="var(--resize-object-handle)"
                  stroke="var(--resize-object-handle-ring)"
                  strokeWidth={1.5}
                  className="pointer-events-auto"
                  style={{ cursor: handle.cursor }}
                  onPointerDown={(event) => beginObjectResize(event, handle.handle)}
                />
              ))}
            </svg>

            {bedPresetHint && (
              <div
                className="room-bed-preset-chip absolute z-30 -translate-x-1/2 -translate-y-[130%] rounded-md px-2 py-0.5 text-[10px] font-semibold pointer-events-none select-none"
                style={{ left: bedPresetHint.x, top: bedPresetHint.y }}
              >
                {bedPresetHint.name}
              </div>
            )}

            {allowResize && !measureMode && (
              <>
                <div
                  onPointerDown={(event) => {
                    if (!event.isPrimary) return;
                    if (event.pointerType === 'mouse' && event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    activeInteractionPointerIdRef.current = event.pointerId;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onLayoutInteractionStart?.();
                    startTelemetrySession('resize');
                    latestPointerRef.current = null;
                    sizeDirtyRef.current = false;
                    isResizingRef.current = 'right';
                    setIsResizing('right');
                  }}
                  className="room-canvas-resize-edge absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 transition-colors"
                />

                <div
                  onPointerDown={(event) => {
                    if (!event.isPrimary) return;
                    if (event.pointerType === 'mouse' && event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    activeInteractionPointerIdRef.current = event.pointerId;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onLayoutInteractionStart?.();
                    startTelemetrySession('resize');
                    latestPointerRef.current = null;
                    sizeDirtyRef.current = false;
                    isResizingRef.current = 'bottom';
                    setIsResizing('bottom');
                  }}
                  className="room-canvas-resize-edge absolute left-0 right-0 bottom-0 h-2 cursor-row-resize z-10 transition-colors"
                />

                <div
                  onPointerDown={(event) => {
                    if (!event.isPrimary) return;
                    if (event.pointerType === 'mouse' && event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    activeInteractionPointerIdRef.current = event.pointerId;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onLayoutInteractionStart?.();
                    startTelemetrySession('resize');
                    latestPointerRef.current = null;
                    sizeDirtyRef.current = false;
                    isResizingRef.current = 'corner';
                    setIsResizing('corner');
                  }}
                  className="room-canvas-resize-corner absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize z-20"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const roomCanvasPropsEqual = (prev: RoomCanvasProps, next: RoomCanvasProps): boolean => (
  prev.items === next.items &&
  prev.selectedItemId === next.selectedItemId &&
  prev.selectedItemIds === next.selectedItemIds &&
  prev.roomWidthCm === next.roomWidthCm &&
  prev.roomHeightCm === next.roomHeightCm &&
  prev.wallThicknessCm === next.wallThicknessCm &&
  prev.allowResize === next.allowResize &&
  prev.gridSpacingCm === next.gridSpacingCm &&
  prev.gridColor === next.gridColor &&
  prev.unit === next.unit &&
  prev.exportRoomId === next.exportRoomId &&
  prev.measures === next.measures &&
  prev.dimensionLabelLayout === next.dimensionLabelLayout &&
  prev.measureMode === next.measureMode &&
  prev.selectedMeasureId === next.selectedMeasureId &&
  prev.isExportingPdf === next.isExportingPdf
);

export default memo(RoomCanvasComponent, roomCanvasPropsEqual);
