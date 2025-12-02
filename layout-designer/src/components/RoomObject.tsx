interface RoomObjectProps {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    rotate?: number;
    label?: string;
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseClick?: (e: React.MouseEvent) => void;
}

export default function RoomObject({ width = 100, height = 100, x = 0, y = 0, rotate = 0, label = "Room Object", onMouseDown, onMouseClick }: RoomObjectProps) {
    
    return (
        <div
            onMouseDown={onMouseDown}
            onClick={onMouseClick}
            className="absolute bg-gray-200 border border-gray-400 cursor-move select-none flex items-center justify-center overflow-hidden text-xs"
            style={{
                width,
                height,
                left: x,
                top: y,
                transform: `rotate(${rotate}deg)`
            }}
        >
            {label}
        </div>
    );
}