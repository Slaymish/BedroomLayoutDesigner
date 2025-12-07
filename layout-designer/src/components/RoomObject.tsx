interface RoomObjectProps {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    rotate?: number;
    label?: string;
    type?: string;
    doorOpenDirection?: 'in' | 'out';
    doorOpenSide?: 'left' | 'right';
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseClick?: (e: React.MouseEvent) => void;
}

export default function RoomObject({ 
    width = 100, 
    height = 100, 
    x = 0, 
    y = 0, 
    rotate = 0, 
    label = "Room Object", 
    type,
    doorOpenDirection = 'in',
    doorOpenSide = 'left',
    onMouseDown, 
    onMouseClick 
}: RoomObjectProps) {
    
    const isDoor = type === 'Door';
    const isWindow = type === 'Window';

    const renderDoorSwing = () => {
        if (!isDoor) return null;

        const swingSize = width; // The door panel width is roughly the frame width
        // We assume the door frame height (depth) is small, e.g. 10cm.
        // The swing starts from the edge of the frame.
        
        // Determine hinge position and swing direction
        // Local coordinates: 0,0 is top-left of the frame box.
        // Frame is width x height.
        
        // 'in' = +Y direction (down), 'out' = -Y direction (up)
        const dirY = doorOpenDirection === 'in' ? 1 : -1;
        
        // Hinge X: 'left' = 0, 'right' = width
        const hingeX = doorOpenSide === 'left' ? 0 : width;
        
        // Hinge Y: 'in' => bottom edge (height), 'out' => top edge (0)
        const hingeY = doorOpenDirection === 'in' ? height : 0;

        // End point of the door panel when fully open (90 degrees)
        // If hinge left (0), open in (+Y): panel goes from (0, height) to (0, height + width)
        // If hinge left (0), open out (-Y): panel goes from (0, 0) to (0, -width)
        // If hinge right (width), open in (+Y): panel goes from (width, height) to (width, height + width)
        // If hinge right (width), open out (-Y): panel goes from (width, 0) to (width, -width)
        
        // Arc start point (closed position):
        // If hinge left: (width, hingeY)
        // If hinge right: (0, hingeY)
        const arcStartX = doorOpenSide === 'left' ? width : 0;
        const arcStartY = hingeY;

        // Arc end point (open position):
        // (hingeX, hingeY + dirY * width)
        const arcEndX = hingeX;
        const arcEndY = hingeY + dirY * width;

        // SVG Path for Arc
        // M hingeX hingeY L arcStartX arcStartY A width width 0 0 1 arcEndX arcEndY L hingeX hingeY
        // Sweep flag depends on side/direction.
        // Left/In: (0,h) -> (w,h) -> (0, h+w). Clockwise? No, (w,h) is right of (0,h). (0, h+w) is below. 
        // Angle 0 to 90. Clockwise.
        
        // Let's just draw the path relative to the container.
        // Since the swing extends outside the container, we need overflow-visible on the container.
        
        const sweep = (doorOpenSide === 'left' && doorOpenDirection === 'in') || (doorOpenSide === 'right' && doorOpenDirection === 'out') ? 1 : 0;

        return (
            <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0, width: '100%', height: '100%' }}>
                <path 
                    d={`M ${hingeX} ${hingeY} L ${arcStartX} ${arcStartY} A ${width} ${width} 0 0 ${sweep} ${arcEndX} ${arcEndY} L ${hingeX} ${hingeY}`}
                    fill="rgba(0,0,0,0.05)"
                    stroke="black"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                />
                {/* Draw the open door panel as a solid line */}
                <line 
                    x1={hingeX} 
                    y1={hingeY} 
                    x2={arcEndX} 
                    y2={arcEndY} 
                    stroke="black" 
                    strokeWidth="2" 
                />
            </svg>
        );
    };

    return (
        <div
            onMouseDown={onMouseDown}
            onClick={onMouseClick}
            className={`absolute ring-1 rounded-xs cursor-move select-none flex items-center justify-center text-xs
                ${isWindow ? 'bg-blue-100 ring-blue-400' : 'bg-gray-100 ring-gray-300'}
                ${isDoor ? 'overflow-visible' : 'overflow-hidden'}
            `}
            style={{
                width,
                height,
                left: x,
                top: y,
                transform: `rotate(${rotate}deg)`
            }}
        >
            {renderDoorSwing()}
            {isWindow && (
                <div className="w-full h-1/3 bg-blue-300 absolute top-1/3 pointer-events-none" />
            )}
            <span className="z-10 pointer-events-none">{label}</span>
        </div>
    );
}