import { useState, useEffect, useRef } from "react"
import RoomObject from "./RoomObject"
import type { RoomItem } from "../types"

interface RoomCanvasProps {
    items: RoomItem[];
    onItemsChange: React.Dispatch<React.SetStateAction<RoomItem[]>>;
}

export default function RoomCanvas({ items, onItemsChange }: RoomCanvasProps) {
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);
    const [isResizing, setIsResizing] = useState<null | 'right' | 'bottom' | 'corner'>(null);
    
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLDivElement>(null);

    const handleObjectMouseDown = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
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

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                
                // Calculate minimum dimensions based on objects
                const minWidth = Math.max(100, ...items.map(i => i.x + i.width));
                const minHeight = Math.max(100, ...items.map(i => i.y + i.height));

                if (isResizing === 'right' || isResizing === 'corner') {
                    setWidth(Math.max(minWidth, e.clientX - rect.left));
                }
                if (isResizing === 'bottom' || isResizing === 'corner') {
                    setHeight(Math.max(minHeight, e.clientY - rect.top));
                }
            } else if (draggingId !== null && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const mouseXInCanvas = e.clientX - rect.left;
                const mouseYInCanvas = e.clientY - rect.top;

                onItemsChange(prevItems => prevItems.map(item => {
                    if (item.id === draggingId) {
                        const newX = mouseXInCanvas - dragOffset.x;
                        const newY = mouseYInCanvas - dragOffset.y;

                        // Clamp position within room bounds
                        const clampedX = Math.max(0, Math.min(newX, width - item.width));
                        const clampedY = Math.max(0, Math.min(newY, height - item.height));

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
            style={{
                width,
                height,
                border: '1px solid black',
                position: 'relative',
                boxSizing: 'border-box',
                backgroundColor: 'white'
            }}
        >
            {items.map(item => (
                <RoomObject 
                    key={item.id}
                    width={item.width} 
                    height={item.height} 
                    x={item.x}
                    y={item.y}
                    label={item.type}
                    onMouseDown={(e) => handleObjectMouseDown(e, item.id)}
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