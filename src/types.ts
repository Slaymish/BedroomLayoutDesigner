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

export type OnboardingStep = 'welcome' | 'dimensions' | 'openings';

export interface RoomSetupState {
    onboardingComplete: boolean;
    onboardingStep: OnboardingStep;
    doorDefaults: {
        doorOpenDirection: 'in' | 'out';
        doorOpenSide: 'left' | 'right';
    };
    windowDraftWidthCm: number;
}

export interface RoomDesign {
    id: string;
    name: string;
    roomWidthCm: number;
    roomHeightCm: number;
    items: RoomItem[];
    nextItemId: number;
    editingItemId: number | null;
    setup: RoomSetupState;
}

export interface WorkspaceState {
    version: number;
    rooms: RoomDesign[];
    activeRoomId: string;
    preferences: Preferences;
}

export interface WorkspaceFile {
    kind: 'BedroomLayoutWorkspace';
    version: 1;
    exportedAtIso: string;
    workspace: WorkspaceState;
}
