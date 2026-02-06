export type OpeningWall = 'top' | 'right' | 'bottom' | 'left';

export interface RoomItem {
    id: number;
    width: number;
    height: number;
    x: number;
    y: number;
    rotate?: number;
    type?: string;
    doorOpenDirection?: 'in' | 'out';
    doorOpenSide?: 'left' | 'right';
    openingWall?: OpeningWall;
}

export interface Preferences {
    gridSize: number;
    gridColor?: string; // CSS color string (e.g., #94a3b8 or rgba(...))
    unit?: 'mm' | 'cm' | 'm' | 'in' | 'ft';
}
