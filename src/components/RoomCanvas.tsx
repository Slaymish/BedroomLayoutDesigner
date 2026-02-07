import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import RoomObject from "./RoomObject"
import type { LayoutInteractionTelemetry, RoomItem } from "../types"
import { fromBaseCm } from "../utils/units"
import { isOpening, snapOpeningToNearestWall } from "../utils/openings"

interface RoomCanvasProps {
    items: RoomItem[];
    onItemsChange: React.Dispatch<React.SetStateAction<RoomItem[]>>;
    onEditItem: (id: number | null) => void;
    selectedItemId: number | null;
    roomWidthCm?: number;
    roomHeightCm?: number;
    allowResize?: boolean;
    onRoomSizeChange?: (roomWidthCm: number, roomHeightCm: number) => void;
    gridSize?: number; // in px
    gridColor?: string; // CSS color string to override --grid-color
    unit?: 'mm' | 'cm' | 'm' | 'in' | 'ft';
    onLayoutInteractionStart?: () => void;
    onLayoutInteractionEnd?: () => void;
    onLayoutTelemetry?: (sample: LayoutInteractionTelemetry) => void;
    exportRoomId?: string;
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

const SLOW_FRAME_THRESHOLD_MS = 24;

const getBoundingBox = (w: number, h: number, rotation: number = 0) => {
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    return {
        width: w * cos + h * sin,
        height: w * sin + h * cos
    };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

function RoomCanvasComponent({
    items,
    onItemsChange,
    onEditItem,
    selectedItemId,
    roomWidthCm = 800,
    roomHeightCm = 600,
    allowResize = true,
    onRoomSizeChange,
    gridSize = 40,
    gridColor,
    unit = 'cm',
    onLayoutInteractionStart,
    onLayoutInteractionEnd,
    onLayoutTelemetry,
    exportRoomId
}: RoomCanvasProps) {
    const [width, setWidth] = useState(roomWidthCm);
    const [height, setHeight] = useState(roomHeightCm);
    const [isResizing, setIsResizing] = useState<null | 'right' | 'bottom' | 'corner'>(null);

    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const hasDragged = useRef(false);

    const canvasRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef(items);
    const widthRef = useRef(width);
    const heightRef = useRef(height);
    const dragOffsetRef = useRef(dragOffset);
    const draggingIdRef = useRef<number | null>(draggingId);
    const isResizingRef = useRef<null | 'right' | 'bottom' | 'corner'>(isResizing);
    const rafRef = useRef<number | null>(null);
    const latestPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
    const telemetrySessionRef = useRef<TelemetrySession | null>(null);

    useEffect(() => {
        setWidth(roomWidthCm);
    }, [roomWidthCm]);

    useEffect(() => {
        setHeight(roomHeightCm);
    }, [roomHeightCm]);

    useEffect(() => {
        onRoomSizeChange?.(width, height);
    }, [width, height, onRoomSizeChange]);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

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
            const currentItems = itemsRef.current;

            const minWidth = Math.max(100, ...currentItems.map(i => {
                const { width: bboxW } = getBoundingBox(i.width, i.height, i.rotate);
                return i.x + i.width / 2 + bboxW / 2;
            }));
            const minHeight = Math.max(100, ...currentItems.map(i => {
                const { height: bboxH } = getBoundingBox(i.width, i.height, i.rotate);
                return i.y + i.height / 2 + bboxH / 2;
            }));

            if (activeResize === 'right' || activeResize === 'corner') {
                const nextWidth = Math.max(minWidth, clientX - rect.left);
                if (nextWidth !== widthRef.current) {
                    markTelemetryChanged();
                }
                setWidth(prev => (prev === nextWidth ? prev : nextWidth));
            }
            if (activeResize === 'bottom' || activeResize === 'corner') {
                const nextHeight = Math.max(minHeight, clientY - rect.top);
                if (nextHeight !== heightRef.current) {
                    markTelemetryChanged();
                }
                setHeight(prev => (prev === nextHeight ? prev : nextHeight));
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

        onItemsChange(prevItems => {
            const targetIndex = prevItems.findIndex(item => item.id === activeDraggingId);
            if (targetIndex < 0) return prevItems;

            const item = prevItems[targetIndex];
            let nextItem = item;

            if (isOpening(item)) {
                const snapped = snapOpeningToNearestWall(item, mouseXInCanvas, mouseYInCanvas, currentWidth, currentHeight);
                if (
                    snapped.x === item.x &&
                    snapped.y === item.y &&
                    snapped.rotate === item.rotate &&
                    snapped.openingWall === item.openingWall
                ) {
                    return prevItems;
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
                    return prevItems;
                }

                nextItem = {
                    ...item,
                    x: clampedX,
                    y: clampedY
                };
                markTelemetryChanged();
            }

            const nextItems = [...prevItems];
            nextItems[targetIndex] = nextItem;
            return nextItems;
        });
    }, [allowResize, markTelemetryChanged, onItemsChange]);

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
            const hadInteraction = (allowResize && isResizingRef.current !== null) || draggingIdRef.current !== null;
            isResizingRef.current = null;
            draggingIdRef.current = null;
            setIsResizing(null);
            setDraggingId(null);
            if (hadInteraction) {
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
        onLayoutInteractionEnd,
        recordAppliedFrame,
        recordPointerEvent,
    ]);

    useEffect(() => {
        return () => {
            flushTelemetrySession();
        };
    }, [flushTelemetrySession]);

    const handleObjectMouseDown = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        hasDragged.current = false;
        latestPointerRef.current = null;

        const item = items.find(i => i.id === id);
        if (!item || !canvasRef.current) return;

        onLayoutInteractionStart?.();
        startTelemetrySession('drag', item.type || 'Object');
        const rect = canvasRef.current.getBoundingClientRect();
        draggingIdRef.current = id;
        setDraggingId(id);

        const mouseXInCanvas = e.clientX - rect.left;
        const mouseYInCanvas = e.clientY - rect.top;
        if (isOpening(item)) {
            const nextOffset = { x: item.width / 2, y: item.height / 2 };
            setDragOffset(nextOffset);
            dragOffsetRef.current = nextOffset;
            return;
        }

        const nextOffset = {
            x: mouseXInCanvas - item.x,
            y: mouseYInCanvas - item.y
        };
        setDragOffset(nextOffset);
        dragOffsetRef.current = nextOffset;
    };

    const handleObjectClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (hasDragged.current) return;
        onEditItem(id);
    };

    const displayWidth = fromBaseCm(width, unit);
    const displayHeight = fromBaseCm(height, unit);
    const openingLabels = useMemo(
        () => items
            .filter(item => item.type === 'Door' || item.type === 'Window')
            .map(item => {
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
        [items, selectedItemId, width, height]
    );

    const canvasStyle = useMemo(
        () => ({
            width,
            height,
            '--grid-size': `${gridSize}px`,
            '--grid-color': gridColor ?? 'rgb(148 163 184 / 0.32)',
        } as React.CSSProperties & Record<'--grid-size' | '--grid-color', string>),
        [gridColor, gridSize, height, width]
    );

    return (
        <div className="workspace-card">
            <div className="workspace-scroll">
                <div className="mx-auto w-fit">
                    <div
                        ref={canvasRef}
                        onClick={() => onEditItem(null)}
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
                        {items.map(item => (
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
                                onMouseDown={(e) => handleObjectMouseDown(e, item.id)}
                                onMouseClick={(e) => handleObjectClick(e, item.id)}
                            />
                        ))}
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

                        {allowResize && (
                            <>
                                <div
                                    onMouseDown={() => {
                                        onLayoutInteractionStart?.();
                                        startTelemetrySession('resize');
                                        latestPointerRef.current = null;
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
    )
}

const roomCanvasPropsEqual = (prev: RoomCanvasProps, next: RoomCanvasProps): boolean => (
    prev.items === next.items &&
    prev.selectedItemId === next.selectedItemId &&
    prev.roomWidthCm === next.roomWidthCm &&
    prev.roomHeightCm === next.roomHeightCm &&
    prev.allowResize === next.allowResize &&
    prev.gridSize === next.gridSize &&
    prev.gridColor === next.gridColor &&
    prev.unit === next.unit &&
    prev.exportRoomId === next.exportRoomId
)

export default memo(RoomCanvasComponent, roomCanvasPropsEqual)
