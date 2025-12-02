import { useState, useEffect, useRef } from "react"
import RoomObject from "./RoomObject"

export default function RoomCanvas() {
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);
    const [isResizing, setIsResizing] = useState<null | 'right' | 'bottom' | 'corner'>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    let objects = [
        <RoomObject width={30} height={50} key={1} />,
        <RoomObject width={100} height={100} key={2} />,
        <RoomObject width={200} height={150} key={3} />
    ]

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                if (isResizing === 'right' || isResizing === 'corner') {
                    setWidth(Math.max(100, e.clientX - rect.left));
                }
                if (isResizing === 'bottom' || isResizing === 'corner') {
                    setHeight(Math.max(100, e.clientY - rect.top));
                }
            }
        };

        const handleMouseUp = () => {
            setIsResizing(null);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return (
        <div
            ref={canvasRef}
            style={{
                width,
                height,
                border: '1px solid black',
                position: 'relative',
                boxSizing: 'border-box'
            }}
        >
            {objects}

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