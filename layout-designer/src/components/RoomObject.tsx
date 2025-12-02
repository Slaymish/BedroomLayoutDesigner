interface RoomObjectProps {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    label?: string;
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseClick?: (e: React.MouseEvent) => void;
}

export default function RoomObject({ width = 100, height = 100, x = 0, y = 0, label = "Room Object", onMouseDown, onMouseClick }: RoomObjectProps) {
    
    return (
        <div
            onMouseDown={onMouseDown}
            onClick={onMouseClick}
            style={{
                width,
                height,
                position: 'absolute',
                left: x,
                top: y,
                backgroundColor: 'lightgray',
                border: '1px solid gray',
                boxSizing: 'border-box',
                cursor: 'move',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                fontSize: '12px'
            }}
        >
            {label}
        </div>
    );
}