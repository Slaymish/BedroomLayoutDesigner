import { memo } from "react";
import type { OpeningWall } from "../types";
import { inferWallFromRotation, rotationForWall } from "../utils/openings";
import type { MouseEvent as ReactMouseEvent } from "react";

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
    onMouseDown?: (e: ReactMouseEvent) => void;
    onMouseClick?: (e: ReactMouseEvent) => void;
}

function RoomObject({ 
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
    const normalizedType = (type || '').trim().toLowerCase();
    const isBed = normalizedType === 'bed';
    const isCouch = normalizedType === 'couch';
    const isDesk = normalizedType === 'desk';
    const isBedsideTable = normalizedType === 'bedside table';
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

    const renderFurnitureDetail = () => {
        if (isDoor || isWindow) return null;

        if (isBed) {
            return (
                <div className="absolute inset-[8%] pointer-events-none">
                    <div className="absolute inset-0 rounded-sm border border-slate-500/70" />
                    <div className="absolute left-[6%] top-[6%] h-[20%] w-[38%] rounded-sm border border-slate-400/70 bg-slate-300/90" />
                    <div className="absolute right-[6%] top-[6%] h-[20%] w-[38%] rounded-sm border border-slate-400/70 bg-slate-300/90" />
                    <div className="absolute left-[6%] right-[6%] top-[32%] bottom-[8%] rounded-sm border border-slate-300/80" />
                </div>
            );
        }

        if (isCouch) {
            return (
                <div className="absolute inset-[8%] pointer-events-none">
                    <div className="absolute inset-0 rounded-sm border border-slate-500/70" />
                    <div className="absolute left-[6%] right-[6%] top-[6%] h-[16%] rounded-sm bg-slate-400/60" />
                    <div className="absolute left-[10%] right-[10%] top-[30%] bottom-[8%] rounded-sm border border-slate-400/80" />
                    <div className="absolute left-1/3 top-[30%] bottom-[8%] border-l border-slate-400/80" />
                    <div className="absolute left-2/3 top-[30%] bottom-[8%] border-l border-slate-400/80" />
                </div>
            );
        }

        if (isDesk) {
            return (
                <div className="absolute inset-[8%] pointer-events-none">
                    <div className="absolute inset-0 rounded-sm border border-slate-500/70" />
                    <div className="absolute left-[8%] right-[8%] top-[8%] h-[18%] rounded-sm bg-slate-300/90 border border-slate-400/80" />
                    <div className="absolute left-[10%] bottom-[8%] w-[10%] h-[24%] bg-slate-400/70 rounded-[2px]" />
                    <div className="absolute right-[10%] bottom-[8%] w-[10%] h-[24%] bg-slate-400/70 rounded-[2px]" />
                    <div className="absolute right-[18%] top-[30%] h-[46%] w-[18%] rounded-sm border border-slate-400/80 bg-slate-200/80" />
                </div>
            );
        }

        if (isBedsideTable) {
            return (
                <div className="absolute inset-[10%] pointer-events-none">
                    <div className="absolute inset-0 rounded-sm border border-slate-500/70" />
                    <div className="absolute left-[8%] right-[8%] top-[12%] h-[12%] rounded-sm bg-slate-300/90" />
                    <div className="absolute left-[10%] right-[10%] top-[44%] border-t border-slate-400/80" />
                    <div className="absolute left-[10%] right-[10%] top-[68%] border-t border-slate-400/80" />
                </div>
            );
        }

        return null;
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
            {renderFurnitureDetail()}
            {showLabel && <span className="z-10 pointer-events-none">{label}</span>}
        </div>
    );
}

const roomObjectPropsEqual = (prev: RoomObjectProps, next: RoomObjectProps): boolean => (
    prev.width === next.width &&
    prev.height === next.height &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.rotate === next.rotate &&
    prev.label === next.label &&
    prev.type === next.type &&
    prev.doorOpenDirection === next.doorOpenDirection &&
    prev.doorOpenSide === next.doorOpenSide &&
    prev.openingWall === next.openingWall &&
    prev.isSelected === next.isSelected &&
    prev.showLabel === next.showLabel
);

export default memo(RoomObject, roomObjectPropsEqual);
