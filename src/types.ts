export type OpeningWall = 'top' | 'right' | 'bottom' | 'left';

export interface MeasureLine {
    id: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    includeInPdf: boolean;
    labelT?: number;
}

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
    gridSpacing: number;
    gridSize?: number; // legacy migration support
    gridColor?: string; // CSS color string (e.g., #94a3b8 or rgba(...))
    unit?: 'mm' | 'cm' | 'm' | 'in' | 'ft';
    wallThicknessCm: number;
    showDebugTelemetry: boolean;
    themeMode: 'system' | 'light' | 'dark';
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
    measures: MeasureLine[];
    nextItemId: number;
    editingItemId: number | null;
    dimensionLabelLayout?: {
        widthLabelT: number;
        heightLabelT: number;
    };
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

export interface LayoutInteractionTelemetry {
    interaction: 'drag' | 'resize';
    itemType?: string;
    changed: boolean;
    durationMs: number;
    pointerEvents: number;
    frameSamples: number;
    avgFrameMs: number;
    maxFrameMs: number;
    slowFrameCount: number;
    timestamp: number;
}
