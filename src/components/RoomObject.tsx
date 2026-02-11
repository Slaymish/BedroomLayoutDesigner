import { memo } from "react";
import type { OpeningWall } from "../types";
import { inferWallFromRotation, rotationForWall } from "../utils/openings";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

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
    bulgeOutward?: boolean;
    onMouseDown?: (e: ReactMouseEvent) => void;
    onPointerDown?: (e: ReactPointerEvent) => void;
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
    bulgeOutward = false,
    onMouseDown, 
    onPointerDown,
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
    const windowOutset = isWindow && bulgeOutward ? height / 2 : 0;
    const objectTransform = isWindow && windowOutset > 0
        ? `rotate(${appliedRotate}deg) translateY(${windowOutset}px)`
        : `rotate(${appliedRotate}deg)`;

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
                    fill="var(--door-swing-fill)"
                    stroke="var(--door-swing-stroke)"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                />
                {/* Draw the open door panel as a solid line */}
                <line 
                    x1={hingeX} 
                    y1={hingeY} 
                    x2={arcEndX} 
                    y2={arcEndY} 
                    stroke="var(--door-swing-stroke)" 
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
                    <div className="absolute inset-0 rounded-sm border room-object-detail-outline" />
                    <div className="absolute left-[6%] top-[6%] h-[20%] w-[38%] rounded-sm border room-object-detail-pillows" />
                    <div className="absolute right-[6%] top-[6%] h-[20%] w-[38%] rounded-sm border room-object-detail-pillows" />
                    <div className="absolute left-[6%] right-[6%] top-[32%] bottom-[8%] rounded-sm border room-object-detail-inner" />
                </div>
            );
        }

        if (isCouch) {
            return (
                <div className="absolute inset-[8%] pointer-events-none">
                    <div className="absolute inset-0 rounded-sm border room-object-detail-outline" />
                    <div className="absolute left-[6%] right-[6%] top-[6%] h-[16%] rounded-sm room-object-detail-fill-strong" />
                    <div className="absolute left-[10%] right-[10%] top-[30%] bottom-[8%] rounded-sm border room-object-detail-inner" />
                    <div className="absolute left-1/3 top-[30%] bottom-[8%] border-l room-object-detail-divider" />
                    <div className="absolute left-2/3 top-[30%] bottom-[8%] border-l room-object-detail-divider" />
                </div>
            );
        }

        if (isDesk) {
            return (
                <div className="absolute inset-[8%] pointer-events-none">
                    <div className="absolute inset-0 rounded-sm border room-object-detail-outline" />
                    <div className="absolute left-[8%] right-[8%] top-[8%] h-[18%] rounded-sm border room-object-detail-tabletop" />
                    <div className="absolute left-[10%] bottom-[8%] w-[10%] h-[24%] rounded-[2px] room-object-detail-leg" />
                    <div className="absolute right-[10%] bottom-[8%] w-[10%] h-[24%] rounded-[2px] room-object-detail-leg" />
                    <div className="absolute right-[18%] top-[30%] h-[46%] w-[18%] rounded-sm border room-object-detail-chair" />
                </div>
            );
        }

        if (isBedsideTable) {
            return (
                <div className="absolute inset-[10%] pointer-events-none">
                    <div className="absolute inset-0 rounded-sm border room-object-detail-outline" />
                    <div className="absolute left-[8%] right-[8%] top-[12%] h-[12%] rounded-sm room-object-detail-fill" />
                    <div className="absolute left-[10%] right-[10%] top-[44%] border-t room-object-detail-divider" />
                    <div className="absolute left-[10%] right-[10%] top-[68%] border-t room-object-detail-divider" />
                </div>
            );
        }

        return null;
    };

    return (
        <div
            onMouseDown={onMouseDown}
            onPointerDown={onPointerDown}
            onClick={onMouseClick}
            className={`room-object absolute rounded-sm cursor-move select-none flex items-center justify-center text-xs font-medium
                ${isDoor ? 'room-object-door' : isWindow ? 'room-object-window' : 'room-object-furniture'}
                ${isSelected ? 'room-object-selected shadow-md z-20' : ''}
                ${(isDoor || isWindow) ? 'overflow-visible' : 'overflow-hidden'}
            `}
            style={{
                width,
                height,
                left: x,
                top: y,
                transform: objectTransform,
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
                <div className="w-full h-1/3 absolute top-1/3 pointer-events-none room-object-window-pane" />
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
    prev.showLabel === next.showLabel &&
    prev.bulgeOutward === next.bulgeOutward
);

export default memo(RoomObject, roomObjectPropsEqual);
