import { useState, useEffect, useRef } from "react"
import RoomObject from "./RoomObject"
import type { RoomItem } from "../types"
import EditObjectPanel from "./EditObjectPanel"

interface RoomCanvasProps {
    items: RoomItem[];
    onItemsChange: React.Dispatch<React.SetStateAction<RoomItem[]>>;
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

export default function RoomCanvas({ items, onItemsChange }: RoomCanvasProps) {
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);
    const [isResizing, setIsResizing] = useState<null | 'right' | 'bottom' | 'corner'>(null);
    
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const hasDragged = useRef(false);

    const canvasRef = useRef<HTMLDivElement>(null);

    const [editObjectPanelOpen, setEditObjectPanelOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<number | null>(null);

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
        
        const item = items.find(i => i.id === id);
        if (item) {
            setEditingItemId(id);
            setEditObjectPanelOpen(true);
        }
        
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

    return (
        <div
            ref={canvasRef}
            onClick={() => setEditObjectPanelOpen(false)}
            style={{
                width,
                height,
                border: '1px solid black',
                position: 'relative',
                boxSizing: 'border-box',
                backgroundColor: 'white'
            }}
        >
            {editObjectPanelOpen && editingItemId !== null && (
                <EditObjectPanel
                    item={items.find(i => i.id === editingItemId)!}
                    onClose={() => setEditObjectPanelOpen(false)}
                    onChange={(updatedItem) => {
                        onItemsChange(prevItems => prevItems.map(i => i.id === updatedItem.id ? updatedItem : i));
                    }}
                />
            )}
            {items.map(item => (
                <RoomObject 
                    key={item.id}
                    width={item.width} 
                    height={item.height} 
                    x={item.x}
                    y={item.y}
                    rotate={item.rotate}
                    label={item.type}
                    onMouseDown={(e) => handleObjectMouseDown(e, item.id)}
                    onMouseClick={(e) => handleObjectClick(e, item.id)}
                />
            ))}

            {/* Right Handle */}
            <div
                onMouseDown={() => setIsResizing('right')}
                style={{
                    position: 'absolute',
                    right: -5,
                    top: 0,
                    bottom: 0,
                    width: 10,
                    cursor: 'col-resize',
                    zIndex: 10
                }}
            />

            {/* Bottom Handle */}
            <div
                onMouseDown={() => setIsResizing('bottom')}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -5,
                    height: 10,
                    cursor: 'row-resize',
                    zIndex: 10
                }}
            />

            {/* Corner Handle */}
            <div
                onMouseDown={() => setIsResizing('corner')}
                style={{
                    position: 'absolute',
                    right: -5,
                    bottom: -5,
                    width: 15,
                    height: 15,
                    cursor: 'nwse-resize',
                    backgroundColor: '#ccc',
                    zIndex: 20
                }}
            />
        </div>
    )
}