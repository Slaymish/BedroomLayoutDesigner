import { useState, useEffect, useRef } from "react"
import RoomObject from "./RoomObject"
import type { RoomItem } from "../types"
import { fromBaseCm } from "../utils/units"

interface RoomCanvasProps {
    items: RoomItem[];
    onItemsChange: React.Dispatch<React.SetStateAction<RoomItem[]>>;
    onEditItem: (id: number | null) => void;
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

export default function RoomCanvas({ items, onItemsChange, onEditItem, gridSize = 40, gridColor, unit = 'cm' }: RoomCanvasProps) {
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);
    const [isResizing, setIsResizing] = useState<null | 'right' | 'bottom' | 'corner'>(null);
    
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const hasDragged = useRef(false);

    const canvasRef = useRef<HTMLDivElement>(null);

    const handleObjectMouseDown = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        hasDragged.current = false;
        const item = items.find(i => i.id === id);
        if (item && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            setDraggingId(id);
            // Calculate offset relative to the item's top-left
            // We need the mouse position relative to the canvas, minus the item's x/y
            const mouseXInCanvas = e.clientX - rect.left;
            const mouseYInCanvas = e.clientY - rect.top;
            
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
            if (isResizing && canvasRef.current) {
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
                        // Special handling for Doors and Windows to snap to walls
                        if (item.type === 'Door' || item.type === 'Window') {
                            // Calculate distances to each wall
                            const distTop = Math.abs(mouseYInCanvas);
                            const distBottom = Math.abs(mouseYInCanvas - height);
                            const distLeft = Math.abs(mouseXInCanvas);
                            const distRight = Math.abs(mouseXInCanvas - width);

                            const minDist = Math.min(distTop, distBottom, distLeft, distRight);

                            let newX = 0;
                            let newY = 0;
                            let newRotate = 0;

                            // Snap to closest wall
                            if (minDist === distTop) {
                                // Top Wall
                                newRotate = 180; // Face in
                                // Center X is mouseX, Center Y is 0
                                // x = cx - w/2, y = cy - h/2
                                // But wait, if rotated 180, w and h are same orientation.
                                newX = mouseXInCanvas - item.width / 2;
                                newY = 0 - item.height / 2;
                            } else if (minDist === distBottom) {
                                // Bottom Wall
                                newRotate = 0; // Face in (up)
                                newX = mouseXInCanvas - item.width / 2;
                                newY = height - item.height / 2;
                            } else if (minDist === distLeft) {
                                // Left Wall
                                newRotate = 90; // Face in (right)
                                // Center X is 0, Center Y is mouseY
                                newX = 0 - item.width / 2;
                                newY = mouseYInCanvas - item.height / 2;
                            } else {
                                // Right Wall
                                newRotate = 270; // Face in (left)
                                newX = width - item.width / 2;
                                newY = mouseYInCanvas - item.height / 2;
                            }

                            // Clamp along the wall
                            if (newRotate === 0 || newRotate === 180) {
                                // Horizontal walls: clamp X
                                newX = Math.max(0, Math.min(newX, width - item.width));
                            } else {
                                // Vertical walls: clamp Y
                                // When rotated 90/270, the visual height is the item.width
                                // The item.y is the top-left of the unrotated box.
                                // The visual center is y + h/2.
                                // We want visual center between 0 + w/2 and height - w/2?
                                // Actually, let's just clamp the center position.
                                // Center Y = newY + item.height / 2
                                // We want Center Y to be within [item.width/2, height - item.width/2]
                                const centerY = newY + item.height / 2;
                                const clampedCenterY = Math.max(item.width / 2, Math.min(centerY, height - item.width / 2));
                                newY = clampedCenterY - item.height / 2;
                            }

                            return {
                                ...item,
                                x: newX,
                                y: newY,
                                rotate: newRotate
                            };
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

        if (isResizing || draggingId !== null) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, draggingId, dragOffset, onItemsChange, items, width, height]);

    const displayWidth = fromBaseCm(width, unit);
    const displayHeight = fromBaseCm(height, unit);

    return (
        <div
            ref={canvasRef}
            onClick={() => onEditItem(null)}
            className="relative bg-white bg-grid rounded-xs shadow-sm ring-1 ring-gray-200"
            style={{
                width,
                height,
                ["--grid-size" as any]: `${gridSize}px`,
                ...(gridColor ? { ["--grid-color" as any]: gridColor } : {}),
            }}
        >
            {/* Width label (top center) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[10px] px-1 py-0.5 bg-white/70 backdrop-blur rounded border border-gray-200 shadow-sm pointer-events-none select-none">
                {Math.round(displayWidth * 100) / 100}{unit}
            </div>
            {/* Height label (left middle rotated) */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full text-[10px] px-1 py-0.5 bg-white/70 backdrop-blur rounded border border-gray-200 shadow-sm pointer-events-none select-none origin-center -rotate-90">
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
                    onMouseDown={(e) => handleObjectMouseDown(e, item.id)}
                    onMouseClick={(e) => handleObjectClick(e, item.id)}
                />
            ))}

            {/* Right Handle */}
            <div
                onMouseDown={() => setIsResizing('right')}
                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
            />

            {/* Bottom Handle */}
            <div
                onMouseDown={() => setIsResizing('bottom')}
                className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize z-10"
            />

            {/* Corner Handle */}
            <div
                onMouseDown={() => setIsResizing('corner')}
                className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize bg-gray-300 z-20"
            />
        </div>
    )
}