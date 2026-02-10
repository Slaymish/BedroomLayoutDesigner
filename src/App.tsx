import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type SetStateAction } from 'react';
import './App.css';
import EditObjectPanel from './components/EditObjectPanel';
import PreferencesPanel from './components/PreferencesPanel';
import RoomCanvas from './components/RoomCanvas';
import RoomWorkspace from './components/RoomWorkspace';
import {
  AppWindow,
  Archive,
  BedDouble,
  DoorOpen,
  LampDesk,
  Plus,
  Redo2,
  Ruler,
  Sofa,
  Square,
  Table2,
  Undo2,
} from 'lucide-react';
import type { LayoutInteractionTelemetry, MeasureLine, RoomDesign, RoomItem, WorkspaceState } from './types';
import { fromBaseCm, toBaseCm, type Unit } from './utils/units';
import { isOpening } from './utils/openings';
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

type ItemUpdateIntent = 'dimensions' | 'rotation' | 'position' | 'generic';

interface ScrollTelemetrySummary {
  sampleCount: number;
  avgFrameMs: number;
  maxFrameMs: number;
  slowFrameRate: number;
  scrollEvents: number;
  isActive: boolean;
}

interface BedSizePreset {
  name: string;
  widthCm: number;
  heightCm: number;
}

interface ObjectPreset {
  type: string;
  widthCm: number;
  heightCm: number;
}

const BED_SIZES: BedSizePreset[] = [
  { name: 'Single', widthCm: 90, heightCm: 190 },
  { name: 'King Single', widthCm: 107, heightCm: 203 },
  { name: 'Double', widthCm: 135, heightCm: 190 },
  { name: 'Queen', widthCm: 150, heightCm: 190 },
  { name: 'King', widthCm: 150, heightCm: 200 },
  { name: 'Super King', widthCm: 180, heightCm: 200 },
];

const QUICK_OBJECT_PRESETS: ObjectPreset[] = [
  { type: 'Wardrobe', widthCm: 150, heightCm: 60 },
  { type: 'Desk', widthCm: 120, heightCm: 60 },
  { type: 'Couch', widthCm: 200, heightCm: 90 },
  { type: 'Bedside Table', widthCm: 45, heightCm: 45 },
  { type: 'Door', widthCm: 80, heightCm: 10 },
  { type: 'Window', widthCm: 100, heightCm: 10 },
];

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

const iconClassName = 'toolbar-icon-svg';

const renderPresetIcon = (type: string) => {
  const normalized = type.trim().toLowerCase();
  if (normalized === 'bed') return <BedDouble className={iconClassName} />;
  if (normalized === 'wardrobe') return <Archive className={iconClassName} />;
  if (normalized === 'desk') return <Table2 className={iconClassName} />;
  if (normalized === 'couch') return <Sofa className={iconClassName} />;
  if (normalized === 'bedside table') return <LampDesk className={iconClassName} />;
  if (normalized === 'door') return <DoorOpen className={iconClassName} />;
  if (normalized === 'window') return <AppWindow className={iconClassName} />;
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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [lastAutosaveAt, setLastAutosaveAt] = useState<number | null>(null);
  const [isAutosavePending, setIsAutosavePending] = useState(false);
  const [layoutTelemetry, setLayoutTelemetry] = useState<LayoutInteractionTelemetry[]>([]);
  const [scrollTelemetry, setScrollTelemetry] = useState<ScrollTelemetrySummary>(DEFAULT_SCROLL_TELEMETRY);
  const [selectedBedPreset, setSelectedBedPreset] = useState(BED_SIZES[0]);
  const [measureMode, setMeasureMode] = useState(false);
  const [selectedMeasureByRoom, setSelectedMeasureByRoom] = useState<Record<string, number | null>>({});
  const [dimensionDraftByRoom, setDimensionDraftByRoom] = useState<Record<string, { width: string; height: string }>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bedPopoverRef = useRef<HTMLDetailsElement>(null);
  const customPopoverRef = useRef<HTMLDetailsElement>(null);
  const interactionStartSnapshotRef = useRef<WorkspaceSnapshot | null>(null);
  const workspaceRef = useRef(workspace);
  const autosaveTimeoutRef = useRef<number | null>(null);
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
  const activeRoom = useMemo(
    () => findRoom(workspace, workspace.activeRoomId),
    [workspace]
  );
  const canEditActiveRoom = !!activeRoom?.setup.onboardingComplete;
  const canAddObjectsToActiveRoom = !!activeRoom && canEditActiveRoom;

  const gridSpacingCm = useMemo(
    () => toBaseCm(workspace.preferences.gridSpacing, activeUnit),
    [activeUnit, workspace.preferences.gridSpacing]
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
      return [...previous, normalized];
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
        setHistoryFuture((futurePrevious) => [...futurePrevious, current]);
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
        setHistoryPast((pastPrevious) => [...pastPrevious, current]);
      }
      restoreSnapshot(target);
      return previous.slice(0, -1);
    });
  }, [restoreSnapshot]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = parseStoredWorkspaceState(stored);
      if (parsed) {
        setWorkspace(parsed);
      }
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const persistWorkspace = useCallback((state: WorkspaceState) => {
    const payload: WorkspaceState = {
      ...state,
      version: WORKSPACE_STORAGE_VERSION,
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...state.preferences,
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const persistWorkspaceAutosave = useCallback((state: WorkspaceState) => {
    persistWorkspace(state);
    setLastAutosaveAt(Date.now());
    setIsAutosavePending(false);
  }, [persistWorkspace]);

  useEffect(() => {
    if (!isHydrated) return;
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
      persistWorkspace(workspaceRef.current);
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
  }, []);

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
      });
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
        width: previous[roomId]?.width ?? '',
        height: previous[roomId]?.height ?? '',
        [field]: value,
      },
    }));
  }, []);

  const clearDimensionDraft = useCallback((roomId: string) => {
    setDimensionDraftByRoom((previous) => {
      if (!(roomId in previous)) return previous;
      const next = { ...previous };
      delete next[roomId];
      return next;
    });
  }, []);

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
  }, [activeUnit, clearDimensionDraft, updateRoom]);

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

    window.localStorage.removeItem(STORAGE_KEY);
    setWorkspace(createDefaultWorkspaceState());
    setHistoryPast([]);
    setHistoryFuture([]);
    setSelectedMeasureByRoom({});
    setDimensionDraftByRoom({});
    interactionStartSnapshotRef.current = null;
    setErrorMessage(null);
    setInfoMessage(null);
    setPreferencesPanelOpen(false);
    setMeasureMode(false);
  };

  const handlePreferencesChange = (preferences: WorkspaceState['preferences']) => {
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
    if (!activeRoom || !activeRoom.setup.onboardingComplete) return;
    addItemToRoom(activeRoom.id, widthCm, heightCm, type);
  }, [activeRoom, addItemToRoom]);

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

          const imageData = await toPng(exportTarget, {
            pixelRatio: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
            backgroundColor: '#ffffff',
            cacheBust: true,
            skipFonts: true,
          });
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const value = new Image();
            value.onload = () => resolve(value);
            value.onerror = () => reject(new Error(`Failed to render ${room.name}.`));
            value.src = imageData;
          });

          if (index > 0) {
            pdf.addPage();
          }

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 28;
          const headerHeight = includeRoomName ? 72 : 58;
          const availableWidth = pageWidth - margin * 2;
          const availableHeight = pageHeight - margin * 2 - headerHeight;
          const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
          const renderWidth = image.width * scale;
          const renderHeight = image.height * scale;
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
          pdf.addImage(imageData, 'PNG', renderX, renderY, renderWidth, renderHeight, undefined, 'FAST');
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
    persistWorkspace(workspaceRef.current);
    setIsAutosavePending(false);
    setInfoMessage('Workspace saved in this browser.');
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

    const measureLength = selectedMeasure
      ? fromBaseCm(
          Math.hypot(selectedMeasure.x2 - selectedMeasure.x1, selectedMeasure.y2 - selectedMeasure.y1),
          activeUnit
        )
      : null;
    const roomNeedsDimensions = !room.setup.onboardingComplete;
    const defaultWidth = Number(fromBaseCm(room.roomWidthCm, activeUnit).toFixed(activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1)).toString();
    const defaultHeight = Number(fromBaseCm(room.roomHeightCm, activeUnit).toFixed(activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1)).toString();
    const dimensionDraft = dimensionDraftByRoom[room.id] ?? { width: defaultWidth, height: defaultHeight };

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
          gridColor={workspace.preferences.gridColor}
          unit={activeUnit}
          onLayoutInteractionStart={handleLayoutInteractionStart}
          onLayoutInteractionEnd={handleLayoutInteractionEnd}
          onLayoutTelemetry={handleLayoutTelemetry}
          exportRoomId={room.id}
          allowResize={isActive && !measureMode && !roomNeedsDimensions}
          measures={room.measures}
          onMeasuresChange={(update) => handleRoomMeasuresChange(room.id, update)}
          measureMode={measureMode && isActive && !roomNeedsDimensions}
          selectedMeasureId={selectedMeasureId}
          onSelectMeasure={(id) => handleRoomMeasureSelection(room.id, id)}
          isExportingPdf={isExportingPdf}
        />
        {isActive && roomNeedsDimensions && (
          <div className="dimensions-overlay" onClick={(event) => event.stopPropagation()}>
            <div className="dimensions-overlay-card">
              <h4 className="text-lg font-semibold text-slate-900">Set Room Dimensions</h4>
              <p className="text-sm text-slate-600">
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
                    value={dimensionDraft.width}
                    onChange={(event) => setDimensionDraftValue(room.id, 'width', event.target.value)}
                  />
                </div>
                <div className="ui-field">
                  <label className="ui-label">Length ({activeUnit})</label>
                  <input
                    className="ui-input"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={dimensionDraft.height}
                    onChange={(event) => setDimensionDraftValue(room.id, 'height', event.target.value)}
                  />
                </div>
              </div>
              <button
                className="ui-btn ui-btn-primary w-full"
                onClick={() => completeRoomDimensions(room.id, dimensionDraft.width, dimensionDraft.height)}
              >
                Save Dimensions
              </button>
            </div>
          </div>
        )}
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
            <h3 className="text-base font-semibold text-slate-900">Edit</h3>
          </div>
          {editingItem ? (
            <EditObjectPanel
              item={editingItem}
              onChange={(item, intent) => {
                handleRoomMeasureSelection(room.id, null);
                updateRoomItem(room.id, item, intent ?? 'generic');
              }}
              onRemove={() => removeSelectedItem(room.id)}
              unit={activeUnit}
            />
          ) : selectedMeasure ? (
            <div className="panel-shell w-full min-w-0 p-3 sm:p-3.5 space-y-3">
              <p className="text-xs text-slate-600">
                Hold <strong>Shift</strong> while dragging nodes for free movement.
              </p>
              <div className="surface-card-muted p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Measurement</p>
                <p className="text-sm text-slate-800">
                  Length: <strong>{Number((measureLength ?? 0).toFixed(activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1))}{activeUnit}</strong>
                </p>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
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
              <p className="text-sm text-slate-600">
                Select an object to edit, or enable ruler mode to create/edit measurements.
              </p>
            </div>
          )}
        </aside>
      </div>
    );
  }, [
    activeUnit,
    gridSpacingCm,
    handleLayoutInteractionEnd,
    handleLayoutInteractionStart,
    handleLayoutTelemetry,
    completeRoomDimensions,
    dimensionDraftByRoom,
    handleRoomItemSelection,
    handleRoomItemsChange,
    handleRoomMeasureSelection,
    handleRoomMeasuresChange,
    handleRoomSizeChange,
    isExportingPdf,
    measureMode,
    removeSelectedItem,
    removeSelectedMeasure,
    setDimensionDraftValue,
    selectedMeasureByRoom,
    updateRoomItem,
    updateSelectedMeasure,
    workspace.preferences.gridColor,
  ]);

  const renderRoomContentRef = useRef(renderRoomContent);
  useEffect(() => {
    renderRoomContentRef.current = renderRoomContent;
  }, [renderRoomContent]);

  const renderRoomContentStable = useCallback((room: RoomDesign, isActive: boolean) => {
    return renderRoomContentRef.current(room, isActive);
  }, []);

  const roomUiStateTokens = useMemo(() => {
    const globalVisualToken = [
      activeUnit,
      workspace.preferences.gridColor || '',
      gridSpacingCm.toFixed(3),
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
        roomDraft ? `${roomDraft.width}:${roomDraft.height}` : 'no-draft',
      ].join('|');
    });
    return tokens;
  }, [
    activeUnit,
    dimensionDraftByRoom,
    gridSpacingCm,
    isExportingPdf,
    measureMode,
    selectedMeasureByRoom,
    workspace.activeRoomId,
    workspace.preferences.gridColor,
    workspace.rooms,
  ]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center px-6">
        <div className="surface-card p-6 text-slate-700">Loading your workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shell">
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
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">Bedroom Layout Designer</h1>
              <p className="app-subtitle">Plan room size, openings, furniture, and measurements.</p>
            </div>
            <div className="app-header-actions">
              <button className="ui-btn ui-btn-primary" onClick={handleAddRoom}>Add Room</button>
              <button className="ui-btn ui-btn-secondary" onClick={handleDuplicateActiveRoom} disabled={!activeRoom}>
                Duplicate Active Room
              </button>
              <details
                className="relative app-export-menu"
                onMouseEnter={warmExportDependencies}
                onFocus={warmExportDependencies}
              >
                <summary className="ui-btn ui-btn-ghost list-none cursor-pointer">
                  {isExportingPdf ? 'Exporting...' : 'Export PDF'}
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
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
      <main className="px-4 py-5 sm:px-6 md:px-8 md:py-7 overflow-x-clip">
        {errorMessage && (
          <p className="mx-auto mb-3 max-w-[1600px] text-sm text-rose-600">{errorMessage}</p>
        )}
        {infoMessage && (
          <p className="mx-auto mb-3 max-w-[1600px] text-sm text-sky-700">{infoMessage}</p>
        )}

        <div className="mx-auto mb-3 max-w-[1600px] command-toolbar">
          <div className="command-toolbar-group">
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
                    const next = BED_SIZES.find((size) => size.name === event.target.value);
                    if (next) setSelectedBedPreset(next);
                  }}
                >
                  {BED_SIZES.map((size) => (
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

            {QUICK_OBJECT_PRESETS.map((preset) => (
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
            <span>{measureMode ? 'Measure mode on' : 'Measure mode off'}</span>
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
              onRenameRoom={handleRenameRoom}
              onDeleteRoom={handleDeleteRoom}
              onReorderRooms={handleReorderRooms}
              renderRoomContent={renderRoomContentStable}
            />
          </section>
        </div>

        {preferencesPanelOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[1px]">
            <div className="modal-shell p-5 w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Workspace Preferences</h2>
                <button
                  className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs"
                  onClick={() => setPreferencesPanelOpen(false)}
                >
                  Close
                </button>
              </div>
              <PreferencesPanel
                onChange={handlePreferencesChange}
                preferences={workspace.preferences}
                onResetSetup={handleResetWorkspace}
                onSaveWorkspace={handleSaveWorkspaceLocal}
                onExportWorkspace={handleExportWorkspaceFile}
                onLoadWorkspace={() => fileInputRef.current?.click()}
                autosaveStatusLabel={autosaveStatusLabel}
              />
              <div className="mt-4 text-xs text-slate-500">
                Supported units: {UNIT_OPTIONS.join(', ')}
              </div>
            </div>
          </div>
        )}
      </main>
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
