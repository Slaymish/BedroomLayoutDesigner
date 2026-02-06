import { useState, useEffect, useRef } from "react"
import RoomObject from "./RoomObject"
import type { RoomItem } from "../types"
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
}

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

export default function RoomCanvas({
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
    unit = 'cm'
}: RoomCanvasProps) {
    const [width, setWidth] = useState(roomWidthCm);
    const [height, setHeight] = useState(roomHeightCm);
    const [isResizing, setIsResizing] = useState<null | 'right' | 'bottom' | 'corner'>(null);
    
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const hasDragged = useRef(false);

    const canvasRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setWidth(roomWidthCm);
    }, [roomWidthCm]);

    useEffect(() => {
        setHeight(roomHeightCm);
    }, [roomHeightCm]);

    useEffect(() => {
        onRoomSizeChange?.(width, height);
    }, [width, height, onRoomSizeChange]);

    const handleObjectMouseDown = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        hasDragged.current = false;
        const item = items.find(i => i.id === id);
        if (item && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            setDraggingId(id);
            const mouseXInCanvas = e.clientX - rect.left;
            const mouseYInCanvas = e.clientY - rect.top;

            if (isOpening(item)) {
                // Drag openings from center so thin frames remain easy to reposition.
                setDragOffset({
                    x: item.width / 2,
                    y: item.height / 2
                });
                return;
            }

            setDragOffset({
                x: mouseXInCanvas - item.x,
                y: mouseYInCanvas - item.y
            });
        }
    };

    const handleObjectClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (hasDragged.current) return;
        
        onEditItem(id);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (allowResize && isResizing && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                
                // Calculate minimum dimensions based on objects
                const minWidth = Math.max(100, ...items.map(i => {
                    const { width: bboxW } = getBoundingBox(i.width, i.height, i.rotate);
                    return i.x + i.width / 2 + bboxW / 2;
                }));
                const minHeight = Math.max(100, ...items.map(i => {
                    const { height: bboxH } = getBoundingBox(i.width, i.height, i.rotate);
                    return i.y + i.height / 2 + bboxH / 2;
                }));

                if (isResizing === 'right' || isResizing === 'corner') {
                    setWidth(Math.max(minWidth, e.clientX - rect.left));
                }
                if (isResizing === 'bottom' || isResizing === 'corner') {
                    setHeight(Math.max(minHeight, e.clientY - rect.top));
                }
            } else if (draggingId !== null && canvasRef.current) {
                hasDragged.current = true;
                const rect = canvasRef.current.getBoundingClientRect();
                const mouseXInCanvas = e.clientX - rect.left;
                const mouseYInCanvas = e.clientY - rect.top;

                onItemsChange(prevItems => prevItems.map(item => {
                    if (item.id === draggingId) {
                        if (isOpening(item)) {
                            return snapOpeningToNearestWall(item, mouseXInCanvas, mouseYInCanvas, width, height);
                        }

                        const newX = mouseXInCanvas - dragOffset.x;
                        const newY = mouseYInCanvas - dragOffset.y;

                        const { width: bboxW, height: bboxH } = getBoundingBox(item.width, item.height, item.rotate);

                        // Calculate valid range for x and y
                        // The bounding box extends from x + width/2 - bboxW/2 to x + width/2 + bboxW/2
                        // We want x + width/2 - bboxW/2 >= 0  => x >= (bboxW - width) / 2
                        // We want x + width/2 + bboxW/2 <= roomWidth => x <= roomWidth - (width + bboxW) / 2

                        const minX = (bboxW - item.width) / 2;
                        const maxX = width - (item.width + bboxW) / 2;
                        
                        const minY = (bboxH - item.height) / 2;
                        const maxY = height - (item.height + bboxH) / 2;

                        // Clamp position within room bounds
                        const clampedX = Math.max(minX, Math.min(newX, maxX));
                        const clampedY = Math.max(minY, Math.min(newY, maxY));

                        return {
                            ...item,
                            x: clampedX,
                            y: clampedY
                        };
                    }
                    return item;
                }));
            }
        };

        const handleMouseUp = () => {
            setIsResizing(null);
            setDraggingId(null);
        };

        if ((allowResize && isResizing) || draggingId !== null) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [allowResize, isResizing, draggingId, dragOffset, onItemsChange, items, width, height]);

    const displayWidth = fromBaseCm(width, unit);
    const displayHeight = fromBaseCm(height, unit);
    const openingLabels = items
        .filter(item => item.type === 'Door' || item.type === 'Window')
        .map(item => {
            const rawX = item.x + item.width / 2;
            const rawY = item.y + item.height / 2;
            const labelX = clamp(rawX, 34, width - 34);
            const labelY = clamp(rawY, 16, height - 16);
            return {
                id: item.id,
                label: item.type || 'Opening',
                x: labelX,
                y: labelY,
                selected: item.id === selectedItemId,
                isDoor: item.type === 'Door',
            };
        });
    const canvasStyle = {
        width,
        height,
        '--grid-size': `${gridSize}px`,
        '--grid-color': gridColor ?? 'rgb(148 163 184 / 0.32)',
    } as React.CSSProperties & Record<'--grid-size' | '--grid-color', string>;

    return (
        <div
            ref={canvasRef}
            onClick={() => onEditItem(null)}
            className="relative bg-white bg-grid rounded-xl shadow-md ring-1 ring-slate-300 overflow-hidden"
            style={canvasStyle}
        >
            {/* Width label (top center) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[10px] px-1.5 py-0.5 bg-white/70 backdrop-blur rounded border border-slate-200 shadow-sm pointer-events-none select-none">
                {Math.round(displayWidth * 100) / 100}{unit}
            </div>
            {/* Height label (left middle rotated) */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full text-[10px] px-1.5 py-0.5 bg-white/70 backdrop-blur rounded border border-slate-200 shadow-sm pointer-events-none select-none origin-center -rotate-90">
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
                    className={`absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold border shadow-sm
                    ${label.isDoor ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-sky-100 text-sky-900 border-sky-300'}
                    ${label.selected ? 'ring-1 ring-slate-500' : ''}
                `}
                    style={{ left: label.x, top: label.y }}
                >
                    {label.label}
                </div>
            ))}

            {allowResize && (
                <>
                    {/* Right Handle */}
                    <div
                        onMouseDown={() => setIsResizing('right')}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-slate-500/20 transition-colors"
                    />

                    {/* Bottom Handle */}
                    <div
                        onMouseDown={() => setIsResizing('bottom')}
                        className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize z-10 hover:bg-slate-500/20 transition-colors"
                    />

                    {/* Corner Handle */}
                    <div
                        onMouseDown={() => setIsResizing('corner')}
                        className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize bg-slate-400 z-20"
                    />
                </>
            )}
        </div>
    )
}
