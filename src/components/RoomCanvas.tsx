import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import RoomObject from "./RoomObject";
import type { LayoutInteractionTelemetry, MeasureLine, RoomItem } from "../types";
import { fromBaseCm } from "../utils/units";
import { isOpening, snapOpeningToNearestWall } from "../utils/openings";

interface RoomCanvasProps {
  items: RoomItem[];
  onItemsChange: Dispatch<SetStateAction<RoomItem[]>>;
  onEditItem: (id: number | null) => void;
  selectedItemId: number | null;
  roomWidthCm?: number;
  roomHeightCm?: number;
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
  measureMode?: boolean;
  selectedMeasureId?: number | null;
  onSelectMeasure?: (id: number | null) => void;
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

interface Point {
  x: number;
  y: number;
}

const SLOW_FRAME_THRESHOLD_MS = 24;
const MIN_MEASURE_LENGTH_CM = 2;
const MEASURE_SNAP_THRESHOLD_CM = 12;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const getBoundingBox = (w: number, h: number, rotation: number = 0) => {
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  return {
    width: w * cos + h * sin,
    height: w * sin + h * cos,
  };
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

const applyMeasureConstraint = (
  raw: Point,
  anchor: Point,
  isFreeMove: boolean,
  snapTargets: Point[],
  roomWidthCm: number,
  roomHeightCm: number
): Point => {
  let constrained: Point = {
    x: clamp(raw.x, 0, roomWidthCm),
    y: clamp(raw.y, 0, roomHeightCm),
  };

  if (isFreeMove) {
    return constrained;
  }

  const deltaX = Math.abs(constrained.x - anchor.x);
  const deltaY = Math.abs(constrained.y - anchor.y);
  if (deltaX >= deltaY) {
    constrained.y = anchor.y;
  } else {
    constrained.x = anchor.x;
  }

  let bestXDelta = MEASURE_SNAP_THRESHOLD_CM + 1;
  let bestYDelta = MEASURE_SNAP_THRESHOLD_CM + 1;

  const xCandidates = [0, roomWidthCm, ...snapTargets.map((point) => point.x)];
  const yCandidates = [0, roomHeightCm, ...snapTargets.map((point) => point.y)];

  xCandidates.forEach((candidate) => {
    const delta = Math.abs(candidate - constrained.x);
    if (delta < bestXDelta) {
      bestXDelta = delta;
      constrained.x = candidate;
    }
  });

  yCandidates.forEach((candidate) => {
    const delta = Math.abs(candidate - constrained.y);
    if (delta < bestYDelta) {
      bestYDelta = delta;
      constrained.y = candidate;
    }
  });

  return {
    x: clamp(constrained.x, 0, roomWidthCm),
    y: clamp(constrained.y, 0, roomHeightCm),
  };
};

function RoomCanvasComponent({
  items,
  onItemsChange,
  onEditItem,
  selectedItemId,
  roomWidthCm = 800,
  roomHeightCm = 600,
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
  measureMode = false,
  selectedMeasureId = null,
  onSelectMeasure,
  isExportingPdf = false,
}: RoomCanvasProps) {
  const [width, setWidth] = useState(roomWidthCm);
  const [height, setHeight] = useState(roomHeightCm);
  const [localItems, setLocalItems] = useState(items);
  const [localMeasures, setLocalMeasures] = useState(measures);
  const [isResizing, setIsResizing] = useState<null | 'right' | 'bottom' | 'corner'>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draftMeasure, setDraftMeasure] = useState<MeasureLine | null>(null);
  const hasDragged = useRef(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const localItemsRef = useRef(localItems);
  const localMeasuresRef = useRef(localMeasures);
  const draftMeasureRef = useRef<MeasureLine | null>(draftMeasure);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const dragOffsetRef = useRef(dragOffset);
  const draggingIdRef = useRef<number | null>(draggingId);
  const isResizingRef = useRef<null | 'right' | 'bottom' | 'corner'>(isResizing);
  const itemsDirtyRef = useRef(false);
  const sizeDirtyRef = useRef(false);
  const measuresDirtyRef = useRef(false);
  const activeMeasureDragRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const telemetrySessionRef = useRef<TelemetrySession | null>(null);

  const setNextLocalItems = useCallback((next: RoomItem[]) => {
    localItemsRef.current = next;
    setLocalItems(next);
  }, []);

  const setNextLocalMeasures = useCallback((next: MeasureLine[]) => {
    localMeasuresRef.current = next;
    setLocalMeasures(next);
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
    isResizingRef.current = isResizing;
  }, [isResizing]);

  const snapTargets = useMemo(() => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];

    localItems.forEach((item) => {
      getRotatedCorners(item).forEach((corner) => {
        points.push({
          x: clamp(corner.x, 0, width),
          y: clamp(corner.y, 0, height),
        });
      });
    });

    return points;
  }, [height, localItems, width]);

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

    if (activeDraggingId === null || !canvasRef.current) {
      return;
    }

    hasDragged.current = true;
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

    const handleMouseMove = (event: MouseEvent) => {
      scheduleFrame(event.clientX, event.clientY);
    };

    const handleMouseUp = () => {
      flushPointer();
      const hadResize = allowResize && isResizingRef.current !== null;
      const hadDrag = draggingIdRef.current !== null;

      isResizingRef.current = null;
      draggingIdRef.current = null;
      setIsResizing(null);
      setDraggingId(null);

      if (hadDrag && itemsDirtyRef.current) {
        itemsDirtyRef.current = false;
        onItemsChange(localItemsRef.current.map((item) => ({ ...item })));
      }

      if (hadResize && sizeDirtyRef.current) {
        sizeDirtyRef.current = false;
        onRoomSizeChange?.(widthRef.current, heightRef.current);
      }

      if (hadDrag || hadResize) {
        onLayoutInteractionEnd?.();
      }
      flushTelemetrySession();
    };

    if ((allowResize && isResizing) || draggingId !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
    onItemsChange,
    onLayoutInteractionEnd,
    onRoomSizeChange,
    recordAppliedFrame,
    recordPointerEvent,
  ]);

  useEffect(() => {
    return () => {
      flushTelemetrySession();
    };
  }, [flushTelemetrySession]);

  const handleObjectMouseDown = (event: ReactMouseEvent, id: number) => {
    if (measureMode) return;
    event.stopPropagation();
    hasDragged.current = false;
    latestPointerRef.current = null;

    const item = localItemsRef.current.find((current) => current.id === id);
    if (!item || !canvasRef.current) return;

    onLayoutInteractionStart?.();
    startTelemetrySession('drag', item.type || 'Object');
    itemsDirtyRef.current = false;
    const rect = canvasRef.current.getBoundingClientRect();
    draggingIdRef.current = id;
    setDraggingId(id);

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

  const handleObjectClick = (event: ReactMouseEvent, id: number) => {
    if (measureMode) return;
    event.stopPropagation();
    if (hasDragged.current) return;
    onSelectMeasure?.(null);
    onEditItem(id);
  };

  const beginMeasureCreate = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!measureMode || !onMeasuresChange || !canvasRef.current || isExportingPdf) {
      return;
    }

    if (event.button !== 0) return;
    event.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const startRaw = toPointInRoom(event.clientX, event.clientY, rect, widthRef.current, heightRef.current);
    const start = applyMeasureConstraint(
      startRaw,
      startRaw,
      event.shiftKey,
      snapTargets,
      widthRef.current,
      heightRef.current
    );

    onLayoutInteractionStart?.();
    onEditItem(null);
    onSelectMeasure?.(null);

    setDraftMeasure({
      id: -1,
      x1: start.x,
      y1: start.y,
      x2: start.x,
      y2: start.y,
      includeInPdf: false,
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const raw = toPointInRoom(moveEvent.clientX, moveEvent.clientY, rect, widthRef.current, heightRef.current);
      const constrained = applyMeasureConstraint(
        raw,
        start,
        moveEvent.shiftKey,
        snapTargets,
        widthRef.current,
        heightRef.current
      );
      setDraftMeasure((prev) => (prev ? { ...prev, x2: constrained.x, y2: constrained.y } : prev));
    };

    const finish = (upEvent: MouseEvent) => {
      const raw = toPointInRoom(upEvent.clientX, upEvent.clientY, rect, widthRef.current, heightRef.current);
      const constrained = applyMeasureConstraint(
        raw,
        start,
        upEvent.shiftKey,
        snapTargets,
        widthRef.current,
        heightRef.current
      );
      const nextMeasure: Omit<MeasureLine, 'id'> = {
        x1: start.x,
        y1: start.y,
        x2: constrained.x,
        y2: constrained.y,
        includeInPdf: false,
      };

      if (distanceBetween({ x: nextMeasure.x1, y: nextMeasure.y1 }, { x: nextMeasure.x2, y: nextMeasure.y2 }) >= MIN_MEASURE_LENGTH_CM) {
        const nextId = getNextMeasureId(localMeasuresRef.current);
        const nextMeasures = [...localMeasuresRef.current, { ...nextMeasure, id: nextId }];
        setNextLocalMeasures(nextMeasures);
        onMeasuresChange(nextMeasures.map((measure) => ({ ...measure })));
        onSelectMeasure?.(nextId);
      }

      setDraftMeasure(null);
      onLayoutInteractionEnd?.();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', finish);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', finish);
  };

  const beginMeasureEndpointDrag = (
    event: ReactMouseEvent,
    measure: MeasureLine,
    endpoint: 'start' | 'end'
  ) => {
    if (!measureMode || !onMeasuresChange || !canvasRef.current || isExportingPdf) return;
    event.stopPropagation();
    event.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const anchor = endpoint === 'start'
      ? { x: measure.x2, y: measure.y2 }
      : { x: measure.x1, y: measure.y1 };

    activeMeasureDragRef.current = true;
    measuresDirtyRef.current = false;
    onLayoutInteractionStart?.();
    onEditItem(null);
    onSelectMeasure?.(measure.id);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const raw = toPointInRoom(moveEvent.clientX, moveEvent.clientY, rect, widthRef.current, heightRef.current);
      const constrained = applyMeasureConstraint(
        raw,
        anchor,
        moveEvent.shiftKey,
        snapTargets,
        widthRef.current,
        heightRef.current
      );

      const nextMeasures = localMeasuresRef.current.map((candidate) => {
        if (candidate.id !== measure.id) return candidate;
        return endpoint === 'start'
          ? { ...candidate, x1: constrained.x, y1: constrained.y }
          : { ...candidate, x2: constrained.x, y2: constrained.y };
      });
      measuresDirtyRef.current = true;
      setNextLocalMeasures(nextMeasures);
    };

    const finish = () => {
      if (measuresDirtyRef.current) {
        measuresDirtyRef.current = false;
        onMeasuresChange(localMeasuresRef.current.map((candidate) => ({ ...candidate })));
      }
      activeMeasureDragRef.current = false;
      onLayoutInteractionEnd?.();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', finish);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', finish);
  };

  const displayedMeasures = useMemo(() => {
    if (!isExportingPdf) return localMeasures;
    return localMeasures.filter((measure) => measure.includeInPdf);
  }, [isExportingPdf, localMeasures]);

  const openingLabels = useMemo(
    () => localItems
      .filter((item) => item.type === 'Door' || item.type === 'Window')
      .map((item) => {
        const rawX = item.x + item.width / 2;
        const rawY = item.y + item.height / 2;
        const labelX = clamp(rawX, 44, width - 44);
        const labelY = clamp(rawY, 20, height - 20);
        return {
          id: item.id,
          label: item.type || 'Opening',
          x: labelX,
          y: labelY,
          selected: item.id === selectedItemId,
          isDoor: item.type === 'Door',
        };
      }),
    [localItems, selectedItemId, width, height]
  );

  const canvasStyle = useMemo(
    () => ({
      width,
      height,
      '--grid-size': `${Math.max(2, gridSpacingCm).toFixed(2)}px`,
      '--grid-color': gridColor ?? 'rgb(148 163 184 / 0.32)',
    } as CSSProperties & Record<'--grid-size' | '--grid-color', string>),
    [gridColor, gridSpacingCm, height, width]
  );

  const displayWidth = fromBaseCm(width, unit);
  const displayHeight = fromBaseCm(height, unit);
  const showMeasureHandles = measureMode && !isExportingPdf;

  return (
    <div className="workspace-card">
      <div className="workspace-scroll">
        <div className="mx-auto w-fit">
          <div
            ref={canvasRef}
            onMouseDown={beginMeasureCreate}
            onClick={() => {
              onEditItem(null);
              onSelectMeasure?.(null);
            }}
            data-floorplan-export-room={exportRoomId}
            data-floorplan-export={exportRoomId ? 'true' : undefined}
            className="relative bg-white bg-grid rounded-xl shadow-sm ring-1 ring-slate-300 overflow-hidden"
            style={canvasStyle}
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 bg-white/86 rounded-md border border-slate-200 shadow-sm pointer-events-none select-none text-slate-600">
              {Math.round(displayWidth * 100) / 100}{unit}
            </div>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 bg-white/86 rounded-md border border-slate-200 shadow-sm pointer-events-none select-none text-slate-600 origin-center -rotate-90">
              {Math.round(displayHeight * 100) / 100}{unit}
            </div>

            {localItems.map((item) => (
              <RoomObject
                key={item.id}
                width={item.width}
                height={item.height}
                x={item.x}
                y={item.y}
                rotate={item.rotate}
                label={item.type}
                type={item.type}
                doorOpenDirection={item.doorOpenDirection}
                doorOpenSide={item.doorOpenSide}
                openingWall={item.openingWall}
                isSelected={item.id === selectedItemId}
                showLabel={item.type !== 'Door' && item.type !== 'Window'}
                onMouseDown={(event) => handleObjectMouseDown(event, item.id)}
                onMouseClick={(event) => handleObjectClick(event, item.id)}
              />
            ))}

            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              {displayedMeasures.map((measure) => {
                const dx = measure.x2 - measure.x1;
                const dy = measure.y2 - measure.y1;
                const lengthCm = Math.hypot(dx, dy);
                const lengthLabel = `${Number(fromBaseCm(lengthCm, unit).toFixed(unit === 'm' || unit === 'ft' ? 2 : 1))}${unit}`;
                const selected = selectedMeasureId === measure.id;
                const midpointX = (measure.x1 + measure.x2) / 2;
                const midpointY = (measure.y1 + measure.y2) / 2;

                return (
                  <g key={`measure-${measure.id}`}>
                    <line
                      x1={measure.x1}
                      y1={measure.y1}
                      x2={measure.x2}
                      y2={measure.y2}
                      stroke={selected ? '#1d4ed8' : '#0f172a'}
                      strokeWidth={selected ? 2.2 : 1.8}
                      strokeDasharray={measure.includeInPdf ? '0' : '5 3'}
                      className={isExportingPdf ? '' : 'cursor-pointer pointer-events-auto'}
                      onMouseDown={(event) => {
                        if (isExportingPdf) return;
                        event.stopPropagation();
                        onEditItem(null);
                        onSelectMeasure?.(measure.id);
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
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          onEditItem(null);
                          onSelectMeasure?.(measure.id);
                        }}
                      />
                    )}
                    <text
                      x={midpointX}
                      y={midpointY - 6}
                      fontSize="10"
                      fill={selected ? '#1d4ed8' : '#334155'}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                    >
                      {lengthLabel}
                    </text>
                    {showMeasureHandles && (
                      <>
                        <circle
                          cx={measure.x1}
                          cy={measure.y1}
                          r={4.5}
                          fill={selected ? '#1d4ed8' : '#334155'}
                          className="cursor-grab pointer-events-auto"
                          onMouseDown={(event) => beginMeasureEndpointDrag(event, measure, 'start')}
                        />
                        <circle
                          cx={measure.x2}
                          cy={measure.y2}
                          r={4.5}
                          fill={selected ? '#1d4ed8' : '#334155'}
                          className="cursor-grab pointer-events-auto"
                          onMouseDown={(event) => beginMeasureEndpointDrag(event, measure, 'end')}
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
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              )}
            </svg>

            {openingLabels.map((label) => (
              <div
                key={`opening-label-${label.id}`}
                className={`absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border shadow-sm
                ${label.isDoor ? 'bg-white text-slate-700 border-slate-300' : 'bg-sky-50 text-sky-800 border-sky-300'}
                ${label.selected ? 'ring-1 ring-slate-500' : ''}
              `}
                style={{ left: label.x, top: label.y }}
              >
                {label.label}
              </div>
            ))}

            {allowResize && !measureMode && (
              <>
                <div
                  onMouseDown={() => {
                    onLayoutInteractionStart?.();
                    startTelemetrySession('resize');
                    latestPointerRef.current = null;
                    sizeDirtyRef.current = false;
                    isResizingRef.current = 'right';
                    setIsResizing('right');
                  }}
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-slate-500/15 transition-colors"
                />

                <div
                  onMouseDown={() => {
                    onLayoutInteractionStart?.();
                    startTelemetrySession('resize');
                    latestPointerRef.current = null;
                    sizeDirtyRef.current = false;
                    isResizingRef.current = 'bottom';
                    setIsResizing('bottom');
                  }}
                  className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize z-10 hover:bg-slate-500/15 transition-colors"
                />

                <div
                  onMouseDown={() => {
                    onLayoutInteractionStart?.();
                    startTelemetrySession('resize');
                    latestPointerRef.current = null;
                    sizeDirtyRef.current = false;
                    isResizingRef.current = 'corner';
                    setIsResizing('corner');
                  }}
                  className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize bg-slate-400 z-20"
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
  prev.roomWidthCm === next.roomWidthCm &&
  prev.roomHeightCm === next.roomHeightCm &&
  prev.allowResize === next.allowResize &&
  prev.gridSpacingCm === next.gridSpacingCm &&
  prev.gridColor === next.gridColor &&
  prev.unit === next.unit &&
  prev.exportRoomId === next.exportRoomId &&
  prev.measures === next.measures &&
  prev.measureMode === next.measureMode &&
  prev.selectedMeasureId === next.selectedMeasureId &&
  prev.isExportingPdf === next.isExportingPdf
);

export default memo(RoomCanvasComponent, roomCanvasPropsEqual);
