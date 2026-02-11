import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type SetStateAction } from 'react';
import './App.css';
import EditObjectPanel from './components/EditObjectPanel';
import PreferencesPanel from './components/PreferencesPanel';
import RoomCanvas from './components/RoomCanvas';
import RoomWorkspace from './components/RoomWorkspace';
import { BED_SIZE_PRESETS, OBJECT_PRESETS, type ObjectPreset } from './constants/objectPresets';
import {
  Archive,
  BedDouble,
  Grid2X2,
  CopyPlus,
  DoorOpen,
  HousePlus,
  LampDesk,
  Monitor,
  Plus,
  Redo2,
  Ruler,
  Sofa,
  Square,
  Undo2,
} from 'lucide-react';
import type { LayoutInteractionTelemetry, MeasureLine, RoomDesign, RoomItem, WorkspaceState } from './types';
import { fromBaseCm, toBaseCm, type Unit } from './utils/units';
import { isOpening } from './utils/openings';
import { getExportCaptureSize } from './utils/exportCapture';
import { buildAutosaveFingerprint } from './utils/autosave';
import {
  DEFAULT_PREFERENCES,
  SOFT_ROOM_WARNING_COUNT,
  STORAGE_KEY,
  UNIT_OPTIONS,
  WORKSPACE_STORAGE_VERSION,
  captureWorkspaceSnapshot,
  cloneRoomItem,
  createBlankRoom,
  createDefaultWorkspaceState,
  createDuplicateRoom,
  findRoom,
  getNextRoomName,
  normalizeOpeningForRoom,
  parseStoredWorkspaceState,
  reorderRooms,
  workspaceSnapshotEquals,
  type WorkspaceSnapshot,
} from './utils/workspaceState';
import { downloadWorkspaceFile, parseWorkspaceFileContent } from './utils/workspaceFile';

interface AddItemOptions {
  select?: boolean;
  x?: number;
  y?: number;
  rotate?: number;
  doorOpenDirection?: 'in' | 'out';
  doorOpenSide?: 'left' | 'right';
}

type ItemUpdateIntent = 'dimensions' | 'rotation' | 'position' | 'generic' | 'scrub';

interface ScrollTelemetrySummary {
  sampleCount: number;
  avgFrameMs: number;
  maxFrameMs: number;
  slowFrameRate: number;
  scrollEvents: number;
  isActive: boolean;
}

interface ExportImageData {
  dataUrl: string;
  width: number;
  height: number;
}

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
};

const DEFAULT_SCROLL_TELEMETRY: ScrollTelemetrySummary = {
  sampleCount: 0,
  avgFrameMs: 0,
  maxFrameMs: 0,
  slowFrameRate: 0,
  scrollEvents: 0,
  isActive: false,
};

const SCROLL_SLOW_FRAME_MS = 24;
const SCROLL_ACTIVE_WINDOW_MS = 140;
const MAX_HISTORY_SNAPSHOTS = 80;

const iconClassName = 'toolbar-icon-svg';

const loadExportImage = (dataUrl: string, roomName: string): Promise<HTMLImageElement> => (
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to render ${roomName}.`));
    image.src = dataUrl;
  })
);

const trimExportImageToVisibleBounds = (image: HTMLImageElement): ExportImageData => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;

  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    return { dataUrl: image.src, width: sourceWidth, height: sourceHeight };
  }

  sourceContext.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const pixels = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data;

  let minX = sourceWidth;
  let minY = sourceHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      const alpha = pixels[(y * sourceWidth + x) * 4 + 3];
      if (alpha === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { dataUrl: image.src, width: sourceWidth, height: sourceHeight };
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (minX === 0 && minY === 0 && width === sourceWidth && height === sourceHeight) {
    return { dataUrl: image.src, width, height };
  }

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  const croppedContext = croppedCanvas.getContext('2d');
  if (!croppedContext) {
    return { dataUrl: image.src, width: sourceWidth, height: sourceHeight };
  }

  croppedContext.fillStyle = '#ffffff';
  croppedContext.fillRect(0, 0, width, height);
  croppedContext.drawImage(
    sourceCanvas,
    minX,
    minY,
    width,
    height,
    0,
    0,
    width,
    height
  );

  return { dataUrl: croppedCanvas.toDataURL('image/png'), width, height };
};

const renderPresetIcon = (type: string) => {
  const normalized = type.trim().toLowerCase();
  if (normalized === 'bed') return <BedDouble className={iconClassName} />;
  if (normalized === 'wardrobe') return <Archive className={iconClassName} />;
  if (normalized === 'desk') return <Monitor className={iconClassName} />;
  if (normalized === 'couch') return <Sofa className={iconClassName} />;
  if (normalized === 'bedside table') return <LampDesk className={iconClassName} />;
  if (normalized === 'door') return <DoorOpen className={iconClassName} />;
  if (normalized === 'window') return <Grid2X2 className={iconClassName} />;
  return <Square className={iconClassName} />;
};

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => createDefaultWorkspaceState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false);
  const [historyPast, setHistoryPast] = useState<WorkspaceSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<WorkspaceSnapshot[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageErrorMessage, setStorageErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [lastAutosaveAt, setLastAutosaveAt] = useState<number | null>(null);
  const [isAutosavePending, setIsAutosavePending] = useState(false);
  const [layoutTelemetry, setLayoutTelemetry] = useState<LayoutInteractionTelemetry[]>([]);
  const [scrollTelemetry, setScrollTelemetry] = useState<ScrollTelemetrySummary>(DEFAULT_SCROLL_TELEMETRY);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [selectedBedPreset, setSelectedBedPreset] = useState(BED_SIZE_PRESETS[0]);
  const [measureMode, setMeasureMode] = useState(false);
  const [selectedMeasureByRoom, setSelectedMeasureByRoom] = useState<Record<string, number | null>>({});
  const [dimensionDraftByRoom, setDimensionDraftByRoom] = useState<Record<string, { width: string; height: string }>>({});
  const [dimensionEditorRoomId, setDimensionEditorRoomId] = useState<string | null>(null);
  const [gridSpacingPreview, setGridSpacingPreview] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bedPopoverRef = useRef<HTMLDetailsElement>(null);
  const customPopoverRef = useRef<HTMLDetailsElement>(null);
  const interactionStartSnapshotRef = useRef<WorkspaceSnapshot | null>(null);
  const workspaceRef = useRef(workspace);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const lastPersistedAutosaveFingerprintRef = useRef<string | null>(null);
  const exportDepsPromiseRef = useRef<Promise<[typeof import('html-to-image'), typeof import('jspdf')]> | null>(null);
  const scrollTelemetryRef = useRef({
    lastFrameAt: 0,
    lastScrollAt: 0,
    frameCount: 0,
    frameMsTotal: 0,
    maxFrameMs: 0,
    slowFrameCount: 0,
    scrollEvents: 0,
  });

  const activeUnit: Unit = workspace.preferences.unit || 'cm';
  const debugTelemetryEnabled = workspace.preferences.showDebugTelemetry;
  const dimensionDraftUnitRef = useRef<Unit>(activeUnit);
  const activeRoom = useMemo(
    () => findRoom(workspace, workspace.activeRoomId),
    [workspace]
  );
  const activeRoomNeedsDimensions = !!activeRoom && (
    !activeRoom.setup.onboardingComplete || dimensionEditorRoomId === activeRoom.id
  );
  const canEditActiveRoom = !!activeRoom && !activeRoomNeedsDimensions;
  const canAddObjectsToActiveRoom = canEditActiveRoom;
  const activeRoomDimensionDraft = useMemo(() => {
    if (!activeRoom) return null;
    const decimals = activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1;
    const defaultWidth = Number(fromBaseCm(activeRoom.roomWidthCm, activeUnit).toFixed(decimals)).toString();
    const defaultHeight = Number(fromBaseCm(activeRoom.roomHeightCm, activeUnit).toFixed(decimals)).toString();
    return dimensionDraftByRoom[activeRoom.id] ?? { width: defaultWidth, height: defaultHeight };
  }, [activeRoom, activeUnit, dimensionDraftByRoom]);
  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (workspace.preferences.themeMode === 'light' || workspace.preferences.themeMode === 'dark') {
      return workspace.preferences.themeMode;
    }
    return systemPrefersDark ? 'dark' : 'light';
  }, [systemPrefersDark, workspace.preferences.themeMode]);

  const effectiveGridSpacing = gridSpacingPreview ?? workspace.preferences.gridSpacing;
  const effectiveGridColor = useMemo(() => {
    const configured = workspace.preferences.gridColor?.trim();
    if (!configured) return undefined;
    const normalized = configured.toLowerCase();
    const defaultColor = (DEFAULT_PREFERENCES.gridColor || '').toLowerCase();
    if (!defaultColor) return configured;
    return normalized === defaultColor ? undefined : configured;
  }, [workspace.preferences.gridColor]);
  const gridSpacingCm = useMemo(
    () => toBaseCm(effectiveGridSpacing, activeUnit),
    [activeUnit, effectiveGridSpacing]
  );

  const telemetryInsights = useMemo(() => {
    if (layoutTelemetry.length === 0) {
      return {
        sampleCount: 0,
        avgDurationMs: 0,
        avgFrameMs: 0,
        maxFrameMs: 0,
        slowFrameRate: 0,
        latest: null as LayoutInteractionTelemetry | null,
      };
    }

    const durationTotal = layoutTelemetry.reduce((sum, sample) => sum + sample.durationMs, 0);
    const totalFrameSamples = layoutTelemetry.reduce((sum, sample) => sum + sample.frameSamples, 0);
    const frameMsTotal = layoutTelemetry.reduce(
      (sum, sample) => sum + sample.avgFrameMs * sample.frameSamples,
      0
    );
    const slowFrameTotal = layoutTelemetry.reduce((sum, sample) => sum + sample.slowFrameCount, 0);
    const maxFrameMs = layoutTelemetry.reduce((max, sample) => Math.max(max, sample.maxFrameMs), 0);

    return {
      sampleCount: layoutTelemetry.length,
      avgDurationMs: durationTotal / layoutTelemetry.length,
      avgFrameMs: totalFrameSamples > 0 ? frameMsTotal / totalFrameSamples : 0,
      maxFrameMs,
      slowFrameRate: totalFrameSamples > 0 ? (slowFrameTotal / totalFrameSamples) * 100 : 0,
      latest: layoutTelemetry[layoutTelemetry.length - 1],
    };
  }, [layoutTelemetry]);

  const pushUndoSnapshot = useCallback((snapshot: WorkspaceSnapshot) => {
    setHistoryPast((previous) => {
      const normalized = {
        ...snapshot,
        rooms: snapshot.rooms.map((room) => ({
          ...room,
          items: room.items.map(cloneRoomItem),
          measures: room.measures.map((measure) => ({ ...measure })),
          setup: {
            ...room.setup,
            doorDefaults: { ...room.setup.doorDefaults },
          },
        })),
      };
      const last = previous[previous.length - 1];
      if (last && workspaceSnapshotEquals(last, normalized)) {
        return previous;
      }
      return [...previous, normalized].slice(-MAX_HISTORY_SNAPSHOTS);
    });
    setHistoryFuture([]);
  }, []);

  const restoreSnapshot = useCallback((snapshot: WorkspaceSnapshot) => {
    setWorkspace((previous) => ({
      ...previous,
      version: WORKSPACE_STORAGE_VERSION,
      rooms: snapshot.rooms,
      activeRoomId: snapshot.activeRoomId,
    }));
  }, []);

  const updateWorkspace = useCallback(
    (
      updater: (current: WorkspaceState) => WorkspaceState,
      options?: { recordHistory?: boolean }
    ) => {
      setWorkspace((previous) => {
        const next = updater(previous);
        if (next === previous) return previous;
        if (options?.recordHistory ?? true) {
          pushUndoSnapshot(captureWorkspaceSnapshot(previous));
        }
        return next;
      });
    },
    [pushUndoSnapshot]
  );

  const updateRoom = useCallback(
    (
      roomId: string,
      updater: (room: RoomDesign) => RoomDesign,
      options?: { recordHistory?: boolean }
    ) => {
      updateWorkspace(
        (current) => {
          let didChange = false;
          const nextRooms = current.rooms.map((room) => {
            if (room.id !== roomId) return room;
            const nextRoom = updater(room);
            if (nextRoom !== room) {
              didChange = true;
            }
            return nextRoom;
          });
          if (!didChange) return current;
          return {
            ...current,
            rooms: nextRooms,
          };
        },
        options
      );
    },
    [updateWorkspace]
  );

  const undo = useCallback(() => {
    setHistoryPast((previous) => {
      if (previous.length === 0) return previous;
      const target = previous[previous.length - 1];
      const current = captureWorkspaceSnapshot(workspaceRef.current);
      if (current) {
        setHistoryFuture((futurePrevious) => [...futurePrevious, current].slice(-MAX_HISTORY_SNAPSHOTS));
      }
      restoreSnapshot(target);
      return previous.slice(0, -1);
    });
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    setHistoryFuture((previous) => {
      if (previous.length === 0) return previous;
      const target = previous[previous.length - 1];
      const current = captureWorkspaceSnapshot(workspaceRef.current);
      if (current) {
        setHistoryPast((pastPrevious) => [...pastPrevious, current].slice(-MAX_HISTORY_SNAPSHOTS));
      }
      restoreSnapshot(target);
      return previous.slice(0, -1);
    });
  }, [restoreSnapshot]);

  useEffect(() => {
    try {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = parseStoredWorkspaceState(stored);
        if (parsed) {
          setWorkspace(parsed);
        }
      } catch {
        setStorageErrorMessage('Local browser storage is unavailable. Export your workspace file to avoid data loss.');
      }
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const persistWorkspace = useCallback((state: WorkspaceState): boolean => {
    try {
      const payload: WorkspaceState = {
        ...state,
        version: WORKSPACE_STORAGE_VERSION,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...state.preferences,
        },
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStorageErrorMessage(null);
      return true;
    } catch {
      setStorageErrorMessage('Autosave failed. Export your workspace file to avoid data loss.');
      return false;
    }
  }, []);

  const persistWorkspaceAutosave = useCallback((state: WorkspaceState) => {
    const fingerprint = buildAutosaveFingerprint(state);
    const persisted = persistWorkspace(state);
    if (persisted) {
      setLastAutosaveAt(Date.now());
      lastPersistedAutosaveFingerprintRef.current = fingerprint;
    }
    setIsAutosavePending(false);
  }, [persistWorkspace]);

  useEffect(() => {
    if (!isHydrated) return;
    const fingerprint = buildAutosaveFingerprint(workspace);

    if (lastPersistedAutosaveFingerprintRef.current === null) {
      lastPersistedAutosaveFingerprintRef.current = fingerprint;
      setIsAutosavePending(false);
      return;
    }

    if (fingerprint === lastPersistedAutosaveFingerprintRef.current) {
      setIsAutosavePending(false);
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
      return;
    }

    setIsAutosavePending(true);
    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      persistWorkspaceAutosave(workspaceRef.current);
      autosaveTimeoutRef.current = null;
    }, 220);
    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [isHydrated, workspace, persistWorkspaceAutosave]);

  useEffect(() => {
    if (!isHydrated) return;
    const flushAutosave = () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
      const state = workspaceRef.current;
      const fingerprint = buildAutosaveFingerprint(state);
      if (lastPersistedAutosaveFingerprintRef.current === fingerprint) return;
      const persisted = persistWorkspace(state);
      if (persisted) {
        lastPersistedAutosaveFingerprintRef.current = fingerprint;
      }
    };
    window.addEventListener('beforeunload', flushAutosave);
    return () => {
      window.removeEventListener('beforeunload', flushAutosave);
    };
  }, [isHydrated, persistWorkspace]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    const previousUnit = dimensionDraftUnitRef.current;
    if (previousUnit === activeUnit) return;

    setDimensionDraftByRoom((previous) => {
      const roomIds = Object.keys(previous);
      if (roomIds.length === 0) {
        return previous;
      }

      const decimals = activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1;
      const convertValue = (rawValue: string): string => {
        const normalized = rawValue.trim();
        if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') {
          return rawValue;
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) return rawValue;
        const valueInCm = toBaseCm(parsed, previousUnit);
        const converted = fromBaseCm(valueInCm, activeUnit);
        return Number(converted.toFixed(decimals)).toString();
      };

      const nextDrafts: Record<string, { width: string; height: string }> = {};
      roomIds.forEach((roomId) => {
        const draft = previous[roomId];
        nextDrafts[roomId] = {
          width: convertValue(draft.width),
          height: convertValue(draft.height),
        };
      });
      return nextDrafts;
    });

    dimensionDraftUnitRef.current = activeUnit;
  }, [activeUnit]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    setSystemPrefersDark(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (!canEditActiveRoom && measureMode) {
      setMeasureMode(false);
    }
  }, [canEditActiveRoom, measureMode]);

  useEffect(() => {
    const metrics = scrollTelemetryRef.current;
    metrics.lastFrameAt = 0;
    metrics.lastScrollAt = 0;
    metrics.frameCount = 0;
    metrics.frameMsTotal = 0;
    metrics.maxFrameMs = 0;
    metrics.slowFrameCount = 0;
    metrics.scrollEvents = 0;

    if (!debugTelemetryEnabled) {
      setScrollTelemetry(DEFAULT_SCROLL_TELEMETRY);
      return;
    }

    const onScroll = () => {
      metrics.lastScrollAt = performance.now();
      metrics.scrollEvents += 1;
    };

    const sample = () => {
      const isActive = performance.now() - metrics.lastScrollAt < SCROLL_ACTIVE_WINDOW_MS;
      const avgFrameMs = metrics.frameCount > 0 ? metrics.frameMsTotal / metrics.frameCount : 0;
      const slowFrameRate = metrics.frameCount > 0 ? (metrics.slowFrameCount / metrics.frameCount) * 100 : 0;
      setScrollTelemetry({
        sampleCount: metrics.frameCount,
        avgFrameMs,
        maxFrameMs: metrics.maxFrameMs,
        slowFrameRate,
        scrollEvents: metrics.scrollEvents,
        isActive,
      });
    };

    let rafId = 0;
    const tick = (now: number) => {
      if (metrics.lastFrameAt > 0 && now - metrics.lastScrollAt < SCROLL_ACTIVE_WINDOW_MS) {
        const delta = now - metrics.lastFrameAt;
        metrics.frameCount += 1;
        metrics.frameMsTotal += delta;
        metrics.maxFrameMs = Math.max(metrics.maxFrameMs, delta);
        if (delta >= SCROLL_SLOW_FRAME_MS) {
          metrics.slowFrameCount += 1;
        }
      }
      metrics.lastFrameAt = now;
      rafId = window.requestAnimationFrame(tick);
    };

    const sampleIntervalId = window.setInterval(sample, 800);
    window.addEventListener('scroll', onScroll, { passive: true });
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(rafId);
      window.clearInterval(sampleIntervalId);
    };
  }, [debugTelemetryEnabled]);

  const clearActiveSelections = useCallback(() => {
    const roomId = workspaceRef.current.activeRoomId;
    updateRoom(
      roomId,
      (room) => ({
        ...room,
        editingItemId: null,
      }),
      { recordHistory: false }
    );
    setSelectedMeasureByRoom((previous) => ({ ...previous, [roomId]: null }));
  }, [updateRoom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMeasureMode(false);
        clearActiveSelections();
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier || event.altKey) return;
      if (isEditableElement(event.target)) return;

      const key = event.key.toLowerCase();
      const undoShortcut = key === 'z' && !event.shiftKey;
      const redoShortcut = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey);
      if (!undoShortcut && !redoShortcut) return;

      if (undoShortcut && historyPast.length > 0) {
        event.preventDefault();
        undo();
        return;
      }

      if (redoShortcut && historyFuture.length > 0) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [clearActiveSelections, historyPast.length, historyFuture.length, redo, undo]);

  const setActiveRoom = useCallback(
    (roomId: string) => {
      updateWorkspace(
        (current) => ({
          ...current,
          activeRoomId: current.rooms.some((room) => room.id === roomId) ? roomId : current.activeRoomId,
        }),
        { recordHistory: false }
      );
    },
    [updateWorkspace]
  );

  const setRoomEditingItem = useCallback(
    (roomId: string, itemId: number | null) => {
      updateRoom(
        roomId,
        (room) => ({
          ...room,
          editingItemId: itemId,
        }),
        { recordHistory: false }
      );
    },
    [updateRoom]
  );

  const handleRoomItemSelection = useCallback((roomId: string, itemId: number | null) => {
    setActiveRoom(roomId);
    setRoomEditingItem(roomId, itemId);
    setSelectedMeasureByRoom((previous) => ({
      ...previous,
      [roomId]: null,
    }));
  }, [setActiveRoom, setRoomEditingItem]);

  const handleRoomMeasureSelection = useCallback((roomId: string, measureId: number | null) => {
    setActiveRoom(roomId);
    setSelectedMeasureByRoom((previous) => ({
      ...previous,
      [roomId]: measureId,
    }));
    if (measureId !== null) {
      setRoomEditingItem(roomId, null);
    }
  }, [setActiveRoom, setRoomEditingItem]);

  const handleLayoutInteractionStart = useCallback(() => {
    if (interactionStartSnapshotRef.current) return;
    interactionStartSnapshotRef.current = captureWorkspaceSnapshot(workspaceRef.current);
  }, []);

  const handleLayoutInteractionEnd = useCallback(() => {
    const startSnapshot = interactionStartSnapshotRef.current;
    interactionStartSnapshotRef.current = null;
    if (!startSnapshot) return;

    window.requestAnimationFrame(() => {
      const endSnapshot = captureWorkspaceSnapshot(workspaceRef.current);
      if (!endSnapshot) return;
      if (!workspaceSnapshotEquals(startSnapshot, endSnapshot)) {
        pushUndoSnapshot(startSnapshot);
      }
    });
  }, [pushUndoSnapshot]);

  const handleLayoutTelemetry = useCallback((sample: LayoutInteractionTelemetry) => {
    setLayoutTelemetry((previous) => {
      const next = [...previous, sample];
      return next.length > 90 ? next.slice(next.length - 90) : next;
    });
  }, []);

  const handleClearPerformanceTelemetry = useCallback(() => {
    setLayoutTelemetry([]);
    setScrollTelemetry(DEFAULT_SCROLL_TELEMETRY);
    const metrics = scrollTelemetryRef.current;
    metrics.lastFrameAt = 0;
    metrics.lastScrollAt = 0;
    metrics.frameCount = 0;
    metrics.frameMsTotal = 0;
    metrics.maxFrameMs = 0;
    metrics.slowFrameCount = 0;
    metrics.scrollEvents = 0;
  }, []);

  const handleRoomItemsChange = useCallback(
    (roomId: string, update: SetStateAction<RoomItem[]>) => {
      updateRoom(
        roomId,
        (room) => {
          const nextItems = typeof update === 'function' ? update(room.items) : update;
          if (nextItems === room.items) return room;
          return {
            ...room,
            items: nextItems,
          };
        },
        { recordHistory: false }
      );
    },
    [updateRoom]
  );

  const handleRoomMeasuresChange = useCallback(
    (roomId: string, update: SetStateAction<MeasureLine[]>) => {
      updateRoom(
        roomId,
        (room) => {
          const nextMeasures = typeof update === 'function' ? update(room.measures) : update;
          if (nextMeasures === room.measures) return room;
          return {
            ...room,
            measures: nextMeasures,
          };
        },
        { recordHistory: false }
      );
    },
    [updateRoom]
  );

  const addItemToRoom = useCallback(
    (roomId: string, width: number, height: number, type: string, options?: AddItemOptions) => {
      updateRoom(roomId, (room) => {
        const newId = room.nextItemId;
        const newItem: RoomItem = {
          id: newId,
          width,
          height,
          x: 0,
          y: 0,
          type,
          rotate: options?.rotate ?? 0,
          ...(type === 'Door'
            ? {
                doorOpenDirection: options?.doorOpenDirection ?? room.setup.doorDefaults.doorOpenDirection,
                doorOpenSide: options?.doorOpenSide ?? room.setup.doorDefaults.doorOpenSide,
              }
            : {}),
        };

        const offset = 36 + (room.items.length % 8) * 22;
        const requestedX = options?.x ?? offset;
        const requestedY = options?.y ?? offset;
        const draftItem = { ...newItem, x: requestedX, y: requestedY };

        let nextItem = draftItem;
        if (isOpening(draftItem)) {
          nextItem = normalizeOpeningForRoom(draftItem, room.roomWidthCm, room.roomHeightCm);
        } else {
          const safeX = Math.max(0, Math.min(requestedX, room.roomWidthCm - width));
          const safeY = Math.max(0, Math.min(requestedY, room.roomHeightCm - height));
          nextItem = { ...draftItem, x: safeX, y: safeY };
        }

        return {
          ...room,
          items: [...room.items, nextItem],
          nextItemId: newId + 1,
          editingItemId: options?.select ?? true ? newId : room.editingItemId,
        };
      });
      setSelectedMeasureByRoom((previous) => ({ ...previous, [roomId]: null }));
    },
    [updateRoom]
  );

  const updateRoomItem = useCallback(
    (roomId: string, updatedItem: RoomItem, intent: ItemUpdateIntent = 'generic') => {
      updateRoom(roomId, (room) => {
        const existing = room.items.find((item) => item.id === updatedItem.id);
        if (!existing) return room;

        let nextItem = { ...updatedItem };

        if (!isOpening(nextItem)) {
          const widthChanged = existing.width !== updatedItem.width;
          const heightChanged = existing.height !== updatedItem.height;
          const rotationChanged = (existing.rotate ?? 0) !== (updatedItem.rotate ?? 0);
          const shouldPreserveCenter =
            intent === 'dimensions' ||
            intent === 'rotation' ||
            widthChanged ||
            heightChanged ||
            rotationChanged;

          if (shouldPreserveCenter) {
            const centerX = existing.x + existing.width / 2;
            const centerY = existing.y + existing.height / 2;
            nextItem = {
              ...nextItem,
              x: centerX - nextItem.width / 2,
              y: centerY - nextItem.height / 2,
            };
          }

          const bbox = getBoundingBox(nextItem.width, nextItem.height, nextItem.rotate);
          const minX = (bbox.width - nextItem.width) / 2;
          const maxX = room.roomWidthCm - (nextItem.width + bbox.width) / 2;
          const minY = (bbox.height - nextItem.height) / 2;
          const maxY = room.roomHeightCm - (nextItem.height + bbox.height) / 2;
          const clampedX = clamp(nextItem.x, Math.min(minX, maxX), Math.max(minX, maxX));
          const clampedY = clamp(nextItem.y, Math.min(minY, maxY), Math.max(minY, maxY));
          nextItem = {
            ...nextItem,
            x: clampedX,
            y: clampedY,
          };
        } else {
          nextItem = normalizeOpeningForRoom(nextItem, room.roomWidthCm, room.roomHeightCm);
        }

        return {
          ...room,
          items: room.items.map((item) => (item.id === nextItem.id ? nextItem : item)),
        };
      }, { recordHistory: intent !== 'scrub' });
    },
    [updateRoom]
  );

  const removeSelectedItem = useCallback(
    (roomId: string) => {
      updateRoom(roomId, (room) => {
        if (room.editingItemId === null) return room;
        return {
          ...room,
          items: room.items.filter((item) => item.id !== room.editingItemId),
          editingItemId: null,
        };
      });
    },
    [updateRoom]
  );

  const removeSelectedMeasure = useCallback((roomId: string, measureId: number) => {
    updateRoom(roomId, (room) => ({
      ...room,
      measures: room.measures.filter((measure) => measure.id !== measureId),
    }));
    setSelectedMeasureByRoom((previous) => ({ ...previous, [roomId]: null }));
  }, [updateRoom]);

  const updateSelectedMeasure = useCallback((roomId: string, measureId: number, update: Partial<MeasureLine>) => {
    updateRoom(roomId, (room) => ({
      ...room,
      measures: room.measures.map((measure) => (
        measure.id === measureId
          ? {
              ...measure,
              ...update,
            }
          : measure
      )),
    }));
  }, [updateRoom]);

  const handleRoomSizeChange = useCallback(
    (roomId: string, widthCm: number, heightCm: number) => {
      updateRoom(
        roomId,
        (room) => {
          if (room.roomWidthCm === widthCm && room.roomHeightCm === heightCm) return room;
          const normalizedItems = room.items.map((item) => {
            if (!isOpening(item)) return item;
            return normalizeOpeningForRoom(item, widthCm, heightCm);
          });
          const normalizedMeasures = room.measures.map((measure) => ({
            ...measure,
            x1: clamp(measure.x1, 0, widthCm),
            y1: clamp(measure.y1, 0, heightCm),
            x2: clamp(measure.x2, 0, widthCm),
            y2: clamp(measure.y2, 0, heightCm),
          }));
          return {
            ...room,
            roomWidthCm: widthCm,
            roomHeightCm: heightCm,
            items: normalizedItems,
            measures: normalizedMeasures,
          };
        },
        { recordHistory: false }
      );
    },
    [updateRoom]
  );

  const setDimensionDraftValue = useCallback((roomId: string, field: 'width' | 'height', value: string) => {
    setDimensionDraftByRoom((previous) => ({
      ...previous,
      [roomId]: {
        width: previous[roomId]?.width ?? (() => {
          const room = workspaceRef.current.rooms.find((candidate) => candidate.id === roomId);
          if (!room) return '';
          const decimals = activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1;
          return Number(fromBaseCm(room.roomWidthCm, activeUnit).toFixed(decimals)).toString();
        })(),
        height: previous[roomId]?.height ?? (() => {
          const room = workspaceRef.current.rooms.find((candidate) => candidate.id === roomId);
          if (!room) return '';
          const decimals = activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1;
          return Number(fromBaseCm(room.roomHeightCm, activeUnit).toFixed(decimals)).toString();
        })(),
        [field]: value,
      },
    }));
  }, [activeUnit]);

  const clearDimensionDraft = useCallback((roomId: string) => {
    setDimensionDraftByRoom((previous) => {
      if (!(roomId in previous)) return previous;
      const next = { ...previous };
      delete next[roomId];
      return next;
    });
  }, []);

  const cancelRoomDimensionEditor = useCallback((roomId: string) => {
    setErrorMessage(null);
    clearDimensionDraft(roomId);
    setDimensionEditorRoomId((current) => (current === roomId ? null : current));
  }, [clearDimensionDraft]);

  const completeRoomDimensions = useCallback((roomId: string, widthInput: string, heightInput: string) => {
    const widthValue = parseFloat(widthInput);
    const heightValue = parseFloat(heightInput);
    if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
      setErrorMessage('Please enter valid room dimensions.');
      return;
    }

    const widthCm = Math.round(toBaseCm(widthValue, activeUnit));
    const heightCm = Math.round(toBaseCm(heightValue, activeUnit));
    if (widthCm < 180 || heightCm < 180) {
      setErrorMessage('Room dimensions are too small. Use at least 180cm x 180cm.');
      return;
    }

    updateRoom(roomId, (room) => ({
      ...room,
      roomWidthCm: widthCm,
      roomHeightCm: heightCm,
      items: room.items.map((item) => (
        isOpening(item)
          ? normalizeOpeningForRoom(item, widthCm, heightCm)
          : item
      )),
      measures: room.measures.map((measure) => ({
        ...measure,
        x1: clamp(measure.x1, 0, widthCm),
        y1: clamp(measure.y1, 0, heightCm),
        x2: clamp(measure.x2, 0, widthCm),
        y2: clamp(measure.y2, 0, heightCm),
      })),
      setup: {
        ...room.setup,
        onboardingComplete: true,
        onboardingStep: 'openings',
      },
      editingItemId: null,
    }));

    setErrorMessage(null);
    clearDimensionDraft(roomId);
    setDimensionEditorRoomId((current) => (current === roomId ? null : current));
  }, [activeUnit, clearDimensionDraft, updateRoom]);

  const openRoomDimensionEditor = useCallback((roomId: string) => {
    const room = workspaceRef.current.rooms.find((candidate) => candidate.id === roomId);
    if (!room) return;

    const decimals = activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1;
    const width = Number(fromBaseCm(room.roomWidthCm, activeUnit).toFixed(decimals)).toString();
    const height = Number(fromBaseCm(room.roomHeightCm, activeUnit).toFixed(decimals)).toString();

    setDimensionDraftByRoom((previous) => ({
      ...previous,
      [roomId]: { width, height },
    }));
    setErrorMessage(null);
    setMeasureMode(false);
    setSelectedMeasureByRoom((previous) => ({ ...previous, [roomId]: null }));
    setRoomEditingItem(roomId, null);
    setActiveRoom(roomId);
    setDimensionEditorRoomId(roomId);
  }, [activeUnit, setActiveRoom, setRoomEditingItem]);

  const handleAddRoom = () => {
    updateWorkspace((current) => {
      const room = createBlankRoom(getNextRoomName(current.rooms));
      return {
        ...current,
        rooms: [...current.rooms, room],
        activeRoomId: room.id,
      };
    });

    const roomCountAfterAdd = workspace.rooms.length + 1;
    if (roomCountAfterAdd >= SOFT_ROOM_WARNING_COUNT) {
      setInfoMessage(`Workspace now has ${roomCountAfterAdd} rooms. Large workspaces may feel slower.`);
    } else {
      setInfoMessage(null);
    }
  };

  const handleDuplicateActiveRoom = () => {
    if (!activeRoom) return;
    updateWorkspace((current) => {
      const source = current.rooms.find((room) => room.id === current.activeRoomId);
      if (!source) return current;
      const duplicate = createDuplicateRoom(source, getNextRoomName(current.rooms));
      return {
        ...current,
        rooms: [...current.rooms, duplicate],
        activeRoomId: duplicate.id,
      };
    });
  };

  const handleActivateRoom = useCallback((roomId: string) => {
    setErrorMessage(null);
    setDimensionEditorRoomId((current) => (current === roomId ? current : null));
    setActiveRoom(roomId);
  }, [setActiveRoom]);

  const handleRenameRoom = useCallback((roomId: string, name: string) => {
    updateRoom(roomId, (room) => ({ ...room, name }));
  }, [updateRoom]);

  const handleDeleteRoom = useCallback((roomId: string) => {
    if (workspace.rooms.length <= 1) {
      setErrorMessage('You must keep at least one room in the workspace.');
      return;
    }

    const targetRoom = workspace.rooms.find((room) => room.id === roomId);
    const confirmed = window.confirm(`Delete ${targetRoom?.name || 'this room'}?`);
    if (!confirmed) return;

    updateWorkspace((current) => {
      if (current.rooms.length <= 1) return current;
      const nextRooms = current.rooms.filter((room) => room.id !== roomId);
      const nextActiveRoomId = current.activeRoomId === roomId
        ? nextRooms[Math.max(0, current.rooms.findIndex((room) => room.id === roomId) - 1)]?.id || nextRooms[0].id
        : current.activeRoomId;
      return {
        ...current,
        rooms: nextRooms,
        activeRoomId: nextActiveRoomId,
      };
    });

    setSelectedMeasureByRoom((previous) => {
      const next = { ...previous };
      delete next[roomId];
      return next;
    });
    clearDimensionDraft(roomId);
    setDimensionEditorRoomId((current) => (current === roomId ? null : current));
  }, [clearDimensionDraft, updateWorkspace, workspace.rooms]);

  const handleReorderRooms = useCallback((sourceRoomId: string, targetRoomId: string) => {
    updateWorkspace((current) => ({
      ...current,
      rooms: reorderRooms(current.rooms, sourceRoomId, targetRoomId),
    }));
  }, [updateWorkspace]);

  const handleResetWorkspace = () => {
    const confirmed = window.confirm(
      'Reset the entire workspace and start over? This removes all room layouts stored in this browser.'
    );
    if (!confirmed) return;

    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setStorageErrorMessage(null);
    } catch {
      setStorageErrorMessage('Browser storage could not be cleared. The workspace has been reset in memory only.');
    }
    setWorkspace(createDefaultWorkspaceState());
    setHistoryPast([]);
    setHistoryFuture([]);
    setSelectedMeasureByRoom({});
    setDimensionDraftByRoom({});
    setDimensionEditorRoomId(null);
    interactionStartSnapshotRef.current = null;
    setErrorMessage(null);
    setInfoMessage(null);
    setPreferencesPanelOpen(false);
    setMeasureMode(false);
    setGridSpacingPreview(null);
  };

  const handlePreferencesChange = (preferences: WorkspaceState['preferences']) => {
    setGridSpacingPreview(null);
    setWorkspace((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        ...preferences,
      },
    }));
  };

  const loadExportDependencies = useCallback(() => {
    if (!exportDepsPromiseRef.current) {
      exportDepsPromiseRef.current = Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
    }
    return exportDepsPromiseRef.current;
  }, []);

  const warmExportDependencies = useCallback(() => {
    void loadExportDependencies();
  }, [loadExportDependencies]);

  const handleAddObjectToActiveRoom = useCallback((widthCm: number, heightCm: number, type: string) => {
    if (!activeRoom || !activeRoom.setup.onboardingComplete || dimensionEditorRoomId === activeRoom.id) return;
    addItemToRoom(activeRoom.id, widthCm, heightCm, type);
  }, [activeRoom, addItemToRoom, dimensionEditorRoomId]);

  const handleQuickAddPreset = useCallback((preset: ObjectPreset) => {
    handleAddObjectToActiveRoom(preset.widthCm, preset.heightCm, preset.type);
  }, [handleAddObjectToActiveRoom]);

  const handleAddSelectedBed = useCallback(() => {
    handleAddObjectToActiveRoom(selectedBedPreset.widthCm, selectedBedPreset.heightCm, 'Bed');
    if (bedPopoverRef.current) {
      bedPopoverRef.current.open = false;
    }
  }, [handleAddObjectToActiveRoom, selectedBedPreset.heightCm, selectedBedPreset.widthCm]);

  const handleAddCustomObject = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const type = (formData.get('type') as string | null)?.trim() || '';
    const widthRaw = parseFloat((formData.get('width') as string | null) || '');
    const heightRaw = parseFloat((formData.get('height') as string | null) || '');
    if (!type || !Number.isFinite(widthRaw) || !Number.isFinite(heightRaw) || widthRaw <= 0 || heightRaw <= 0) {
      return;
    }

    handleAddObjectToActiveRoom(
      toBaseCm(widthRaw, activeUnit),
      toBaseCm(heightRaw, activeUnit),
      type
    );
    form.reset();
    if (customPopoverRef.current) {
      customPopoverRef.current.open = false;
    }
  }, [activeUnit, handleAddObjectToActiveRoom]);

  const handleExportRoomPdf = useCallback(
    async (roomsToExport: RoomDesign[], includeRoomName: boolean) => {
      if (roomsToExport.length === 0) return;
      setIsExportingPdf(true);
      setErrorMessage(null);

      try {
        const [{ toPng }, { jsPDF }] = await loadExportDependencies();

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        for (let index = 0; index < roomsToExport.length; index += 1) {
          const room = roomsToExport[index];
          const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-floorplan-export-room]'));
          const exportTarget = nodes.find((node) => node.dataset.floorplanExportRoom === room.id);
          if (!exportTarget) {
            throw new Error(`Could not find canvas for ${room.name}.`);
          }

          const captureSize = getExportCaptureSize(exportTarget);
          const imageData = await toPng(exportTarget, {
            width: captureSize.width,
            height: captureSize.height,
            canvasWidth: captureSize.width,
            canvasHeight: captureSize.height,
            pixelRatio: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
            cacheBust: true,
            skipFonts: true,
            style: {
              margin: '0',
            },
          });
          const renderedImage = await loadExportImage(imageData, room.name);
          const trimmedImage = trimExportImageToVisibleBounds(renderedImage);

          if (index > 0) {
            pdf.addPage();
          }

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 28;
          const headerHeight = includeRoomName ? 72 : 58;
          const availableWidth = pageWidth - margin * 2;
          const availableHeight = pageHeight - margin * 2 - headerHeight;
          const scale = Math.min(availableWidth / trimmedImage.width, availableHeight / trimmedImage.height);
          const renderWidth = trimmedImage.width * scale;
          const renderHeight = trimmedImage.height * scale;
          const renderX = (pageWidth - renderWidth) / 2;
          const renderY = margin + headerHeight + Math.max(0, (availableHeight - renderHeight) / 2);

          const roomWidth = fromBaseCm(room.roomWidthCm, activeUnit);
          const roomHeight = fromBaseCm(room.roomHeightCm, activeUnit);
          const decimals = activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1;
          const roomSizeLabel = `${roomWidth.toFixed(decimals)}${activeUnit} x ${roomHeight.toFixed(decimals)}${activeUnit}`;

          pdf.setFontSize(14);
          pdf.setTextColor(15, 23, 42);
          pdf.text(includeRoomName ? room.name : 'Bedroom Layout Floorplan', margin, margin + 14);
          pdf.setFontSize(10);
          pdf.setTextColor(71, 85, 105);
          pdf.text(`Room dimensions: ${roomSizeLabel}`, margin, margin + 32);
          pdf.text(`Exported: ${new Date().toLocaleString()}`, margin, margin + 46);
          if (includeRoomName) {
            pdf.text(`Room ${index + 1} of ${roomsToExport.length}`, margin, margin + 60);
          }
          pdf.addImage(trimmedImage.dataUrl, 'PNG', renderX, renderY, renderWidth, renderHeight, undefined, 'FAST');
        }

        const dateLabel = new Date().toISOString().slice(0, 10);
        const fileName = roomsToExport.length === 1
          ? `bedroom-floorplan-${dateLabel}.pdf`
          : `bedroom-workspace-floorplans-${dateLabel}.pdf`;
        pdf.save(fileName);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to export PDF.';
        setErrorMessage(message);
      } finally {
        setIsExportingPdf(false);
      }
    },
    [activeUnit, loadExportDependencies]
  );

  const handleExportActiveRoomPdf = () => {
    if (!activeRoom) return;
    handleExportRoomPdf([activeRoom], false);
  };

  const handleExportAllRoomsPdf = () => {
    handleExportRoomPdf(workspace.rooms, true);
  };

  const handleSaveWorkspaceLocal = () => {
    const state = workspaceRef.current;
    const persisted = persistWorkspace(state);
    setIsAutosavePending(false);
    if (persisted) {
      lastPersistedAutosaveFingerprintRef.current = buildAutosaveFingerprint(state);
      setInfoMessage('Workspace saved in this browser.');
      return;
    }
    setErrorMessage('Could not save workspace in this browser.');
  };

  const handleExportWorkspaceFile = () => {
    downloadWorkspaceFile(workspaceRef.current);
    setInfoMessage('Workspace exported to JSON file.');
  };

  const handleLoadWorkspaceFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parseWorkspaceFileContent(text);
      const confirmed = window.confirm('Replace your current workspace with this file?');
      if (!confirmed) return;

      setWorkspace(imported);
      setHistoryPast([]);
      setHistoryFuture([]);
      setSelectedMeasureByRoom({});
      setDimensionDraftByRoom({});
      setDimensionEditorRoomId(null);
      interactionStartSnapshotRef.current = null;
      setErrorMessage(null);
      setInfoMessage('Workspace loaded successfully.');
      setMeasureMode(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load workspace file.';
      setErrorMessage(message);
    }
  };

  const autosaveStatusLabel = useMemo(() => {
    if (isAutosavePending) {
      return 'Autosave pending...';
    }
    if (lastAutosaveAt === null) {
      return 'Autosave enabled';
    }
    return `Last autosave: ${new Date(lastAutosaveAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  }, [isAutosavePending, lastAutosaveAt]);

  const renderRoomContent = useCallback((room: RoomDesign, isActive: boolean) => {
    const selectedMeasureId = selectedMeasureByRoom[room.id] ?? null;
    const selectedMeasure = selectedMeasureId !== null
      ? room.measures.find((measure) => measure.id === selectedMeasureId) || null
      : null;
    const editingItem = room.editingItemId !== null
      ? room.items.find((item) => item.id === room.editingItemId) || null
      : null;
    const editPanelTitle = editingItem
      ? `Edit ${(editingItem.type || 'Object').trim() || 'Object'}`
      : selectedMeasure
        ? 'Edit Measurement'
        : 'Edit';

    const measureLength = selectedMeasure
      ? fromBaseCm(
          Math.hypot(selectedMeasure.x2 - selectedMeasure.x1, selectedMeasure.y2 - selectedMeasure.y1),
          activeUnit
        )
      : null;
    const isDimensionsEditorOpen = dimensionEditorRoomId === room.id;
    const roomNeedsDimensions = !room.setup.onboardingComplete || isDimensionsEditorOpen;

    const canvas = (
      <div className="relative">
        <RoomCanvas
          items={room.items}
          onItemsChange={(update) => handleRoomItemsChange(room.id, update)}
          onEditItem={(itemId) => handleRoomItemSelection(room.id, itemId)}
          selectedItemId={room.editingItemId}
          roomWidthCm={room.roomWidthCm}
          roomHeightCm={room.roomHeightCm}
          onRoomSizeChange={(widthCm, heightCm) => handleRoomSizeChange(room.id, widthCm, heightCm)}
          gridSpacingCm={gridSpacingCm}
          gridColor={effectiveGridColor}
          unit={activeUnit}
          onLayoutInteractionStart={handleLayoutInteractionStart}
          onLayoutInteractionEnd={handleLayoutInteractionEnd}
          onLayoutTelemetry={handleLayoutTelemetry}
          exportRoomId={room.id}
          allowResize={false}
          measures={room.measures}
          onMeasuresChange={(update) => handleRoomMeasuresChange(room.id, update)}
          measureMode={measureMode && isActive && !roomNeedsDimensions}
          selectedMeasureId={selectedMeasureId}
          onSelectMeasure={(id) => handleRoomMeasureSelection(room.id, id)}
          isExportingPdf={isExportingPdf}
        />
      </div>
    );

    if (!isActive) {
      return canvas;
    }

    return (
      <div className="room-designer-layout">
        <div className="room-designer-canvas">{canvas}</div>
        <aside className="surface-card room-edit-rail" onClick={(event) => event.stopPropagation()}>
          <div className="room-edit-rail-header">
            <h3 className="text-base font-semibold theme-text-heading">{editPanelTitle}</h3>
          </div>
          {measureMode && (
            <div className="surface-card-muted px-3 py-2 mb-2">
              <p className="text-xs theme-text-soft">
                Measure mode: drag on the canvas to draw a measure. Hold <strong>Shift</strong> to move freely.
              </p>
            </div>
          )}
          {editingItem ? (
            <EditObjectPanel
              item={editingItem}
              onChange={(item, intent) => {
                handleRoomMeasureSelection(room.id, null);
                updateRoomItem(room.id, item, intent ?? 'generic');
              }}
              onScrubStart={handleLayoutInteractionStart}
              onScrubEnd={handleLayoutInteractionEnd}
              onRemove={() => removeSelectedItem(room.id)}
              unit={activeUnit}
            />
          ) : selectedMeasure ? (
            <div className="panel-shell w-full min-w-0 p-3 sm:p-3.5 space-y-3">
              <p className="text-xs theme-text-muted">
                Hold <strong>Shift</strong> while dragging nodes for free movement.
              </p>
              <div className="surface-card-muted p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide theme-text-muted">Measurement</p>
                <p className="text-sm theme-text-strong">
                  Length: <strong>{Number((measureLength ?? 0).toFixed(activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1))}{activeUnit}</strong>
                </p>
                <label className="inline-flex items-center gap-2 text-sm theme-text-soft">
                  <input
                    type="checkbox"
                    checked={selectedMeasure.includeInPdf}
                    onChange={(event) => {
                      updateSelectedMeasure(room.id, selectedMeasure.id, {
                        includeInPdf: event.target.checked,
                      });
                    }}
                  />
                  Include in PDF export
                </label>
              </div>
              <button
                className="ui-btn ui-btn-secondary w-full"
                onClick={() => removeSelectedMeasure(room.id, selectedMeasure.id)}
              >
                Delete Measure
              </button>
            </div>
          ) : (
            <div className="panel-shell w-full min-w-0 p-3 sm:p-3.5">
              {measureMode ? (
                <div className="space-y-2 text-sm theme-text-muted">
                  <p>Drag on the canvas to draw a measure.</p>
                  <p>Hold <strong>Shift</strong> while dragging to move freely without snap/axis lock.</p>
                </div>
              ) : (
                <p className="text-sm theme-text-muted">
                  Select an object to edit, or enable ruler mode to create/edit measurements.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    );
  }, [
    activeUnit,
    dimensionEditorRoomId,
    gridSpacingCm,
    handleLayoutInteractionEnd,
    handleLayoutInteractionStart,
    handleLayoutTelemetry,
    handleRoomItemSelection,
    handleRoomItemsChange,
    handleRoomMeasureSelection,
    handleRoomMeasuresChange,
    handleRoomSizeChange,
    isExportingPdf,
    measureMode,
    removeSelectedItem,
    removeSelectedMeasure,
    selectedMeasureByRoom,
    updateRoomItem,
    updateSelectedMeasure,
    effectiveGridColor,
  ]);

  const renderRoomContentRef = useRef(renderRoomContent);
  renderRoomContentRef.current = renderRoomContent;

  const renderRoomContentStable = useCallback((room: RoomDesign, isActive: boolean) => {
    return renderRoomContentRef.current(room, isActive);
  }, []);

  const roomUiStateTokens = useMemo(() => {
    const globalVisualToken = [
      activeUnit,
      effectiveGridColor || 'theme-default',
      String(effectiveGridSpacing),
      String(gridSpacingCm),
      isExportingPdf ? '1' : '0',
    ].join('|');

    const tokens: Record<string, string> = {};
    workspace.rooms.forEach((room) => {
      const isActive = room.id === workspace.activeRoomId;
      const roomDraft = dimensionDraftByRoom[room.id];
      tokens[room.id] = [
        globalVisualToken,
        isActive ? 'active' : 'inactive',
        isActive ? (measureMode ? 'measure-on' : 'measure-off') : 'na',
        isActive ? String(selectedMeasureByRoom[room.id] ?? 'none') : 'na',
        room.setup.onboardingComplete ? 'ready' : 'needs-dimensions',
        dimensionEditorRoomId === room.id ? 'dimension-editor-open' : 'dimension-editor-closed',
        roomDraft ? `${roomDraft.width}:${roomDraft.height}` : 'no-draft',
      ].join('|');
    });
    return tokens;
  }, [
    activeUnit,
    dimensionEditorRoomId,
    dimensionDraftByRoom,
    gridSpacingCm,
    isExportingPdf,
    measureMode,
    selectedMeasureByRoom,
    effectiveGridSpacing,
    effectiveGridColor,
    workspace.activeRoomId,
    workspace.rooms,
  ]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center px-6">
        <div className="surface-card p-6 theme-text-soft">Loading your workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shell flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleLoadWorkspaceFile}
      />
      <header className="app-header px-4 py-5 sm:px-6 md:px-8 md:py-6">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="app-header-top">
            <div className="app-brand-block">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold theme-text-heading">Bedroom Layout Designer</h1>
              <p className="app-subtitle">Plan room size, openings, furniture, and measurements.</p>
            </div>
            <div className="app-header-actions">
              <details
                className="relative app-export-menu"
                onMouseEnter={warmExportDependencies}
                onFocus={warmExportDependencies}
              >
                <summary className="ui-btn ui-btn-ghost list-none cursor-pointer">
                  {isExportingPdf ? 'Exporting...' : 'Export PDF'}
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 p-2 surface-popover">
                  <button
                    className="ui-btn ui-btn-subtle w-full justify-start"
                    onClick={handleExportActiveRoomPdf}
                    disabled={!activeRoom || isExportingPdf}
                  >
                    Export Active Room PDF
                  </button>
                  <button
                    className="ui-btn ui-btn-subtle w-full justify-start mt-1"
                    onClick={handleExportAllRoomsPdf}
                    disabled={workspace.rooms.length === 0 || isExportingPdf}
                  >
                    Export All Rooms PDF
                  </button>
                </div>
              </details>
              <button className="ui-btn ui-btn-ghost" onClick={() => setPreferencesPanelOpen(true)}>
                Preferences
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="px-4 py-5 sm:px-6 md:px-8 md:py-7 overflow-x-clip flex-1">
        {errorMessage && (
          <p className="mx-auto mb-3 max-w-[1600px] text-sm app-message-error">{errorMessage}</p>
        )}
        {storageErrorMessage && (
          <p className="mx-auto mb-3 max-w-[1600px] text-sm app-message-error">{storageErrorMessage}</p>
        )}
        {infoMessage && (
          <p className="mx-auto mb-3 max-w-[1600px] text-sm app-message-info">{infoMessage}</p>
        )}

        <div className="mx-auto mb-3 max-w-[1600px] command-toolbar">
          <div className="command-toolbar-group">
            <button
              className="ui-btn ui-btn-subtle toolbar-icon-btn"
              onClick={handleAddRoom}
              aria-label="Add room"
              title="Add room"
            >
              <HousePlus className={iconClassName} />
            </button>
            <button
              className="ui-btn ui-btn-subtle toolbar-icon-btn"
              onClick={handleDuplicateActiveRoom}
              disabled={!activeRoom}
              aria-label="Duplicate active room"
              title="Duplicate active room"
            >
              <CopyPlus className={iconClassName} />
            </button>

            <div className="toolbar-divider" />

            <button
              className="ui-btn ui-btn-subtle toolbar-icon-btn disabled:opacity-50"
              onClick={undo}
              disabled={historyPast.length === 0}
              aria-label="Undo"
              title={`Undo (${historyPast.length})`}
            >
              <Undo2 className={iconClassName} />
            </button>
            <button
              className="ui-btn ui-btn-subtle toolbar-icon-btn disabled:opacity-50"
              onClick={redo}
              disabled={historyFuture.length === 0}
              aria-label="Redo"
              title={`Redo (${historyFuture.length})`}
            >
              <Redo2 className={iconClassName} />
            </button>

            <div className="toolbar-divider" />

            <details ref={bedPopoverRef} className="toolbar-popover" onMouseDown={(event) => event.stopPropagation()}>
              <summary className="ui-btn ui-btn-subtle toolbar-icon-btn" aria-label="Add bed" title="Add bed">
                <BedDouble className={iconClassName} />
              </summary>
              <div className="toolbar-popover-panel">
                <label className="ui-label">Bed size</label>
                <select
                  className="ui-select"
                  value={selectedBedPreset.name}
                  onChange={(event) => {
                    const next = BED_SIZE_PRESETS.find((size) => size.name === event.target.value);
                    if (next) setSelectedBedPreset(next);
                  }}
                >
                  {BED_SIZE_PRESETS.map((size) => (
                    <option key={size.name} value={size.name}>
                      {size.name} ({size.widthCm}x{size.heightCm}cm)
                    </option>
                  ))}
                </select>
                <button
                  className="ui-btn ui-btn-primary w-full mt-2"
                  onClick={handleAddSelectedBed}
                  disabled={!canAddObjectsToActiveRoom}
                >
                  Add Bed
                </button>
              </div>
            </details>

            {OBJECT_PRESETS.map((preset) => (
              <button
                key={preset.type}
                className="ui-btn ui-btn-subtle toolbar-icon-btn"
                onClick={() => handleQuickAddPreset(preset)}
                disabled={!canAddObjectsToActiveRoom}
                title={`Add ${preset.type}`}
                aria-label={`Add ${preset.type}`}
              >
                {renderPresetIcon(preset.type)}
              </button>
            ))}

            <details ref={customPopoverRef} className="toolbar-popover" onMouseDown={(event) => event.stopPropagation()}>
              <summary className="ui-btn ui-btn-subtle toolbar-icon-btn" aria-label="Add custom object" title="Add custom object">
                <Plus className={iconClassName} />
              </summary>
              <form className="toolbar-popover-panel" onSubmit={handleAddCustomObject}>
                <div className="ui-field">
                  <label className="ui-label">Type</label>
                  <input className="ui-input" type="text" name="type" required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="ui-field">
                    <label className="ui-label">W ({activeUnit})</label>
                    <input className="ui-input" type="number" name="width" min={0.1} step={0.1} required />
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">L ({activeUnit})</label>
                    <input className="ui-input" type="number" name="height" min={0.1} step={0.1} required />
                  </div>
                </div>
                <button className="ui-btn ui-btn-primary w-full mt-2" type="submit" disabled={!canAddObjectsToActiveRoom}>
                  Add Custom
                </button>
              </form>
            </details>

            <div className="toolbar-divider" />

            <button
              className={`ui-btn ui-btn-subtle toolbar-icon-btn ${measureMode ? 'toolbar-icon-btn-active' : ''}`}
              disabled={!canEditActiveRoom}
              onClick={() => {
                setMeasureMode((previous) => {
                  const next = !previous;
                  if (next) {
                    clearActiveSelections();
                  }
                  return next;
                });
              }}
              title={measureMode ? 'Exit measure mode' : 'Enter measure mode'}
              aria-label={measureMode ? 'Exit measure mode' : 'Enter measure mode'}
            >
              <Ruler className={iconClassName} />
            </button>
          </div>

          <div className="command-toolbar-meta">
            <span className={`autosave-status-chip ${isAutosavePending ? 'autosave-status-chip-pending' : ''}`}>
              {autosaveStatusLabel}
            </span>
            {workspace.preferences.showDebugTelemetry && (
              <>
                <span>Scroll {scrollTelemetry.avgFrameMs > 0 ? `${scrollTelemetry.avgFrameMs.toFixed(1)}ms` : '--'}</span>
                <span>Drag {telemetryInsights.avgFrameMs > 0 ? `${telemetryInsights.avgFrameMs.toFixed(1)}ms` : '--'}</span>
                <details className="perf-details">
                  <summary className="perf-summary">Performance</summary>
                  <div className="perf-popover">
                    <p className="perf-title">Layout</p>
                    <p className="perf-row">Samples: {telemetryInsights.sampleCount}</p>
                    <p className="perf-row">Avg action: {Math.round(telemetryInsights.avgDurationMs)}ms</p>
                    <p className="perf-row">Max frame: {telemetryInsights.maxFrameMs > 0 ? telemetryInsights.maxFrameMs.toFixed(1) : '--'}ms</p>
                    <p className="perf-row">Slow frames: {telemetryInsights.slowFrameRate.toFixed(1)}%</p>
                    <p className="perf-row">Last: {telemetryInsights.latest ? telemetryInsights.latest.interaction : 'none'}</p>
                    <p className="perf-title mt-2">Scroll</p>
                    <p className="perf-row">Events: {scrollTelemetry.scrollEvents}</p>
                    <p className="perf-row">Frames: {scrollTelemetry.sampleCount}</p>
                    <p className="perf-row">Avg frame: {scrollTelemetry.avgFrameMs > 0 ? scrollTelemetry.avgFrameMs.toFixed(1) : '--'}ms</p>
                    <p className="perf-row">Max frame: {scrollTelemetry.maxFrameMs > 0 ? scrollTelemetry.maxFrameMs.toFixed(1) : '--'}ms</p>
                    <p className="perf-row">Slow frames: {scrollTelemetry.slowFrameRate.toFixed(1)}%</p>
                    <button
                      className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1 text-[11px] mt-1"
                      onClick={handleClearPerformanceTelemetry}
                      disabled={telemetryInsights.sampleCount === 0 && scrollTelemetry.sampleCount === 0}
                    >
                      Clear
                    </button>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-[1600px]">
          <section className="panel-shell min-w-0">
            <RoomWorkspace
              rooms={workspace.rooms}
              activeRoomId={workspace.activeRoomId}
              unit={activeUnit}
              roomUiStateTokens={roomUiStateTokens}
              onActivateRoom={handleActivateRoom}
              onEditRoomDimensions={openRoomDimensionEditor}
              onRenameRoom={handleRenameRoom}
              onDeleteRoom={handleDeleteRoom}
              onReorderRooms={handleReorderRooms}
              renderRoomContent={renderRoomContentStable}
            />
          </section>
        </div>

        {activeRoom && activeRoomNeedsDimensions && activeRoomDimensionDraft && (
          <div className="fixed inset-0 z-20 flex items-center justify-center p-4 modal-backdrop">
            <form
              className="dimensions-overlay-card"
              onSubmit={(event) => {
                event.preventDefault();
                completeRoomDimensions(activeRoom.id, activeRoomDimensionDraft.width, activeRoomDimensionDraft.height);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelRoomDimensionEditor(activeRoom.id);
                }
              }}
            >
              <h4 className="text-lg font-semibold theme-text-heading">Set Room Dimensions</h4>
              <p className="text-sm theme-text-muted">
                Enter width and length before adding objects to this room.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="ui-field">
                  <label className="ui-label">Width ({activeUnit})</label>
                  <input
                    className="ui-input"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={activeRoomDimensionDraft.width}
                    onChange={(event) => setDimensionDraftValue(activeRoom.id, 'width', event.target.value)}
                  />
                </div>
                <div className="ui-field">
                  <label className="ui-label">Length ({activeUnit})</label>
                  <input
                    className="ui-input"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={activeRoomDimensionDraft.height}
                    onChange={(event) => setDimensionDraftValue(activeRoom.id, 'height', event.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button className="ui-btn ui-btn-primary w-full" type="submit">
                  Save Dimensions
                </button>
                {activeRoom.setup.onboardingComplete && dimensionEditorRoomId === activeRoom.id && (
                  <button
                    className="ui-btn ui-btn-ghost"
                    type="button"
                    onClick={() => cancelRoomDimensionEditor(activeRoom.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {preferencesPanelOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center p-4 modal-backdrop">
            <div className="modal-shell p-5 w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold theme-text-heading">Workspace Preferences</h2>
                <button
                  className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs"
                  onClick={() => {
                    setGridSpacingPreview(null);
                    setPreferencesPanelOpen(false);
                  }}
                >
                  Close
                </button>
              </div>
              <PreferencesPanel
                onChange={handlePreferencesChange}
                onGridSpacingPreviewChange={setGridSpacingPreview}
                preferences={workspace.preferences}
                onResetSetup={handleResetWorkspace}
                onSaveWorkspace={handleSaveWorkspaceLocal}
                onExportWorkspace={handleExportWorkspaceFile}
                onLoadWorkspace={() => fileInputRef.current?.click()}
                autosaveStatusLabel={autosaveStatusLabel}
              />
              <div className="mt-4 text-xs theme-text-subtle">
                Supported units: {UNIT_OPTIONS.join(', ')}
              </div>
            </div>
          </div>
        )}

      </main>
      <footer className="mt-auto px-4 pb-2 sm:px-6 md:px-8">
        <div className="mx-auto w-full max-w-[1600px] text-[11px] theme-text-subtle text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>
              Made by{' '}
              <a
                href="https://hamishburke.dev/projects/bedroom-layout-designer"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Hamish
              </a>
            </span>
            <span aria-hidden="true">•</span>
            <span>
              Open source on{' '}
              <a
                href="https://github.com/Slaymish/BedroomLayoutDesigner"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                GitHub
              </a>
            </span>
            <span aria-hidden="true">•</span>
            <a
              href="https://buymeacoffee.com/hamishapps"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Buy me a coffee
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

const getBoundingBox = (w: number, h: number, rotation: number = 0) => {
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  return {
    width: w * cos + h * sin,
    height: w * sin + h * cos,
  };
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

export default App;
