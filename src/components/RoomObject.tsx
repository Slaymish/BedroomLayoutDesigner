import type { OpeningWall } from "../types";
import { inferWallFromRotation, rotationForWall } from "../utils/openings";

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
    openingWall?: OpeningWall;
    isSelected?: boolean;
    showLabel?: boolean;
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
    openingWall,
    isSelected = false,
    showLabel = true,
    onMouseDown, 
    onMouseClick 
}: RoomObjectProps) {
    
    const isDoor = type === 'Door';
    const isWindow = type === 'Window';
    const resolvedWall = openingWall ?? inferWallFromRotation(rotate) ?? 'bottom';
    const appliedRotate = isDoor || isWindow ? rotationForWall(resolvedWall) : rotate;
    const openingHitInset = isDoor || isWindow ? 14 : 0;

    const renderDoorSwing = () => {
        if (!isDoor) return null;

        // Openings are normalized so local -Y points toward room interior.
        const swingDirection = doorOpenDirection === 'in' ? -1 : 1;
        const hingeX = doorOpenSide === 'left' ? 0 : width;
        const hingeY = doorOpenDirection === 'in' ? 0 : height;
        const arcStartX = doorOpenSide === 'left' ? width : 0;
        const arcStartY = hingeY;
        const arcEndX = hingeX;
        const arcEndY = hingeY + swingDirection * width;
        const sweep = (doorOpenSide === 'left' && doorOpenDirection === 'out') || (doorOpenSide === 'right' && doorOpenDirection === 'in') ? 1 : 0;

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
            className={`absolute ring-1 rounded-sm cursor-move select-none flex items-center justify-center text-xs font-medium text-slate-800
                ${isWindow ? 'bg-sky-100 ring-sky-400' : 'bg-slate-100 ring-slate-300'}
                ${isSelected ? 'ring-2 ring-slate-500 shadow-md z-20' : ''}
                ${(isDoor || isWindow) ? 'overflow-visible' : 'overflow-hidden'}
            `}
            style={{
                width,
                height,
                left: x,
                top: y,
                transform: `rotate(${appliedRotate}deg)`,
                transformOrigin: 'center center'
            }}
        >
            {(isDoor || isWindow) && (
                <div
                    className="absolute"
                    style={{
                        left: -openingHitInset,
                        right: -openingHitInset,
                        top: -openingHitInset,
                        bottom: -openingHitInset,
                    }}
                    aria-hidden="true"
                />
            )}
            {renderDoorSwing()}
            {isWindow && (
                <div className="w-full h-1/3 bg-sky-300 absolute top-1/3 pointer-events-none" />
            )}
            {showLabel && <span className="z-10 pointer-events-none">{label}</span>}
        </div>
    );
}
