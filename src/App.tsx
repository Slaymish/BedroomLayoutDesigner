import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type SetStateAction } from 'react';
import './App.css';
import AddObjectPanel from './components/AddObjectPanel';
import EditObjectPanel from './components/EditObjectPanel';
import PreferencesPanel from './components/PreferencesPanel';
import RoomCanvas from './components/RoomCanvas';
import RoomOnboardingPanel from './components/RoomOnboardingPanel';
import RoomWorkspace from './components/RoomWorkspace';
import type { RoomDesign, RoomItem, WorkspaceState } from './types';
import { fromBaseCm, type Unit } from './utils/units';
import { isOpening } from './utils/openings';
import {
  DEFAULT_PREFERENCES,
  OPENING_PRESETS,
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

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
};

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => createDefaultWorkspaceState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [historyPast, setHistoryPast] = useState<WorkspaceSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<WorkspaceSnapshot[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const interactionStartSnapshotRef = useRef<WorkspaceSnapshot | null>(null);
  const latestSnapshotRef = useRef<WorkspaceSnapshot | null>(null);
  const workspaceRef = useRef(workspace);
  const autosaveTimeoutRef = useRef<number | null>(null);

  const activeUnit: Unit = workspace.preferences.unit || 'cm';
  const activeRoom = useMemo(
    () => findRoom(workspace, workspace.activeRoomId),
    [workspace]
  );
  const activeEditingItem = useMemo(
    () =>
      activeRoom && activeRoom.editingItemId !== null
        ? activeRoom.items.find((item) => item.id === activeRoom.editingItemId) || null
        : null,
    [activeRoom]
  );

  const pushUndoSnapshot = useCallback((snapshot: WorkspaceSnapshot) => {
    setHistoryPast((previous) => {
      const normalized = {
        ...snapshot,
        rooms: snapshot.rooms.map((room) => ({
          ...room,
          items: room.items.map(cloneRoomItem),
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
      const current = latestSnapshotRef.current;
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
      const current = latestSnapshotRef.current;
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

  useEffect(() => {
    if (!isHydrated) return;
    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      persistWorkspace(workspaceRef.current);
      autosaveTimeoutRef.current = null;
    }, 220);
    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [isHydrated, workspace, persistWorkspace]);

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
    latestSnapshotRef.current = captureWorkspaceSnapshot(workspace);
  }, [workspace]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAddPanelOpen(false);
        setIsEditPanelOpen(false);
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
  }, [historyPast.length, historyFuture.length, redo, undo]);

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
    if (itemId !== null) {
      setIsEditPanelOpen(true);
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
      const endSnapshot = latestSnapshotRef.current;
      if (!endSnapshot) return;
      if (!workspaceSnapshotEquals(startSnapshot, endSnapshot)) {
        pushUndoSnapshot(startSnapshot);
      }
    });
  }, [pushUndoSnapshot]);

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
                doorOpenDirection: options?.doorOpenDirection ?? 'in',
                doorOpenSide: options?.doorOpenSide ?? 'left',
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
    },
    [updateRoom]
  );

  const updateRoomItem = useCallback(
    (roomId: string, updatedItem: RoomItem) => {
      updateRoom(roomId, (room) => {
        const existing = room.items.find((item) => item.id === updatedItem.id);
        if (!existing) return room;

        let nextItem = { ...updatedItem };
        const windowResized = existing.type === 'Window' && (
          existing.width !== updatedItem.width ||
          existing.height !== updatedItem.height
        );

        if (windowResized) {
          const centerX = existing.x + existing.width / 2;
          const centerY = existing.y + existing.height / 2;
          nextItem = {
            ...nextItem,
            x: centerX - updatedItem.width / 2,
            y: centerY - updatedItem.height / 2,
          };
        }

        if (isOpening(nextItem)) {
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
          return {
            ...room,
            roomWidthCm: widthCm,
            roomHeightCm: heightCm,
            items: normalizedItems,
          };
        },
        { recordHistory: false }
      );
    },
    [updateRoom]
  );

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

  const handleRenameRoom = (roomId: string, name: string) => {
    updateRoom(roomId, (room) => ({ ...room, name }));
  };

  const handleDeleteRoom = (roomId: string) => {
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
  };

  const handleReorderRooms = (sourceRoomId: string, targetRoomId: string) => {
    updateWorkspace((current) => ({
      ...current,
      rooms: reorderRooms(current.rooms, sourceRoomId, targetRoomId),
    }));
  };

  const handleResetWorkspace = () => {
    const confirmed = window.confirm(
      'Reset the entire workspace and start over? This removes all room layouts stored in this browser.'
    );
    if (!confirmed) return;

    window.localStorage.removeItem(STORAGE_KEY);
    setWorkspace(createDefaultWorkspaceState());
    setHistoryPast([]);
    setHistoryFuture([]);
    interactionStartSnapshotRef.current = null;
    latestSnapshotRef.current = null;
    setErrorMessage(null);
    setInfoMessage(null);
    setPreferencesPanelOpen(false);
    setIsAddPanelOpen(false);
    setIsEditPanelOpen(false);
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

  const handleOnboardingStep = (roomId: string, step: RoomDesign['setup']['onboardingStep']) => {
    updateRoom(roomId, (room) => ({
      ...room,
      setup: {
        ...room.setup,
        onboardingStep: step,
      },
      editingItemId: null,
    }));
  };

  const handleOnboardingDimensions = (roomId: string, widthCm: number, heightCm: number) => {
    updateRoom(roomId, (room) => ({
      ...room,
      roomWidthCm: widthCm,
      roomHeightCm: heightCm,
      items: room.items
        .filter((item) => item.type === 'Door' || item.type === 'Window')
        .map((item) => normalizeOpeningForRoom(item, widthCm, heightCm)),
      editingItemId: null,
    }));
  };

  const handleOnboardingAddOpening = (
    roomId: string,
    type: 'Door' | 'Window',
    windowWidthCm?: number
  ) => {
    updateRoom(roomId, (room) => {
      const openingWidthCm = type === 'Window'
        ? Math.max(1, Math.round(windowWidthCm ?? room.setup.windowDraftWidthCm))
        : OPENING_PRESETS.Door.widthCm;
      const openingHeightCm = type === 'Window' ? OPENING_PRESETS.Window.heightCm : OPENING_PRESETS.Door.heightCm;
      const spawnX = Math.max(0, room.roomWidthCm / 2 - openingWidthCm / 2);
      const spawnY = type === 'Door'
        ? Math.max(0, room.roomHeightCm - openingHeightCm / 2)
        : Math.max(0, openingHeightCm);

      const newId = room.nextItemId;
      const draftItem: RoomItem = {
        id: newId,
        width: openingWidthCm,
        height: openingHeightCm,
        x: spawnX,
        y: spawnY,
        type,
        doorOpenDirection: type === 'Door' ? room.setup.doorDefaults.doorOpenDirection : undefined,
        doorOpenSide: type === 'Door' ? room.setup.doorDefaults.doorOpenSide : undefined,
      };

      return {
        ...room,
        items: [...room.items, normalizeOpeningForRoom(draftItem, room.roomWidthCm, room.roomHeightCm)],
        nextItemId: newId + 1,
        editingItemId: newId,
      };
    });
  };

  const handleOnboardingDoorDefaults = (
    roomId: string,
    field: 'doorOpenDirection' | 'doorOpenSide',
    value: 'in' | 'out' | 'left' | 'right'
  ) => {
    updateRoom(roomId, (room) => ({
      ...room,
      setup: {
        ...room.setup,
        doorDefaults: {
          ...room.setup.doorDefaults,
          [field]: value,
        },
      },
    }));
  };

  const handleOnboardingWindowDraft = (roomId: string, widthCm: number) => {
    updateRoom(
      roomId,
      (room) => ({
        ...room,
        setup: {
          ...room.setup,
          windowDraftWidthCm: Math.max(1, widthCm),
        },
      }),
      { recordHistory: false }
    );
  };

  const handleOnboardingFinish = (roomId: string) => {
    updateRoom(roomId, (room) => ({
      ...room,
      editingItemId: null,
      setup: {
        ...room.setup,
        onboardingComplete: true,
      },
    }));
  };

  const handleAddObjectToActiveRoom = (widthCm: number, heightCm: number, type: string) => {
    if (!activeRoom || !activeRoom.setup.onboardingComplete) return;
    addItemToRoom(activeRoom.id, widthCm, heightCm, type);
  };

  const handleEditItemInActiveRoom = (item: RoomItem) => {
    if (!activeRoom) return;
    updateRoomItem(activeRoom.id, item);
  };

  const handleRemoveActiveSelection = () => {
    if (!activeRoom) return;
    removeSelectedItem(activeRoom.id);
  };

  const handleExportRoomPdf = useCallback(
    async (roomsToExport: RoomDesign[], includeRoomName: boolean) => {
      if (roomsToExport.length === 0) return;
      setIsExportingPdf(true);
      setErrorMessage(null);

      try {
        const [{ toPng }, { jsPDF }] = await Promise.all([
          import('html-to-image'),
          import('jspdf'),
        ]);

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
    [activeUnit]
  );

  const handleExportActiveRoomPdf = () => {
    if (!activeRoom) return;
    handleExportRoomPdf([activeRoom], false);
  };

  const handleExportAllRoomsPdf = () => {
    handleExportRoomPdf(workspace.rooms, true);
  };

  const handleSaveWorkspaceFile = () => {
    downloadWorkspaceFile(workspace);
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
      interactionStartSnapshotRef.current = null;
      latestSnapshotRef.current = captureWorkspaceSnapshot(imported);
      setErrorMessage(null);
      setInfoMessage('Workspace loaded successfully.');
      setIsAddPanelOpen(false);
      setIsEditPanelOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load workspace file.';
      setErrorMessage(message);
    }
  };

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
        <div className="mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">Bedroom Layout Designer</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button className="ui-btn ui-btn-primary" onClick={handleAddRoom}>Add Room</button>
            <button className="ui-btn ui-btn-secondary" onClick={handleDuplicateActiveRoom} disabled={!activeRoom}>
              Duplicate Active Room
            </button>
            <button className="ui-btn ui-btn-ghost" onClick={handleSaveWorkspaceFile}>Save Workspace</button>
            <button className="ui-btn ui-btn-ghost" onClick={() => fileInputRef.current?.click()}>
              Load Workspace
            </button>
            <details className="relative">
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
      </header>
      <main className="px-4 py-5 sm:px-6 md:px-8 md:py-7 overflow-x-clip">
        {errorMessage && (
          <p className="mx-auto mb-3 max-w-[1600px] text-sm text-rose-600">{errorMessage}</p>
        )}
        {infoMessage && (
          <p className="mx-auto mb-3 max-w-[1600px] text-sm text-sky-700">{infoMessage}</p>
        )}
        <div className="mx-auto mb-3 max-w-[1600px] flex flex-wrap items-center gap-2">
          <button
            className="ui-btn ui-btn-subtle disabled:opacity-50"
            onClick={undo}
            disabled={historyPast.length === 0}
          >
            Undo
          </button>
          <button
            className="ui-btn ui-btn-subtle disabled:opacity-50"
            onClick={redo}
            disabled={historyFuture.length === 0}
          >
            Redo
          </button>
          <span className="text-xs text-slate-600">Rooms: {workspace.rooms.length}</span>
        </div>

        <button
          className={`side-drawer-toggle side-drawer-toggle-left ${isAddPanelOpen ? 'open' : ''}`}
          onClick={() => setIsAddPanelOpen((current) => !current)}
          aria-label={isAddPanelOpen ? 'Hide add objects panel' : 'Show add objects panel'}
        >
          {isAddPanelOpen ? 'Hide Add' : 'Show Add'}
        </button>
        <button
          className={`side-drawer-toggle side-drawer-toggle-right ${isEditPanelOpen ? 'open' : ''}`}
          onClick={() => setIsEditPanelOpen((current) => !current)}
          aria-label={isEditPanelOpen ? 'Hide edit object panel' : 'Show edit object panel'}
        >
          {isEditPanelOpen ? 'Hide Edit' : 'Show Edit'}
        </button>

        <div className="mx-auto max-w-[1600px]">
          <section className="panel-shell min-w-0">
            <RoomWorkspace
              rooms={workspace.rooms}
              activeRoomId={workspace.activeRoomId}
              unit={activeUnit}
              onActivateRoom={(roomId) => {
                setErrorMessage(null);
                setActiveRoom(roomId);
              }}
              onRenameRoom={handleRenameRoom}
              onDeleteRoom={handleDeleteRoom}
              onReorderRooms={handleReorderRooms}
              renderRoomContent={(room, isActive) => {
                const editingItem = room.editingItemId !== null
                  ? room.items.find((item) => item.id === room.editingItemId) || null
                  : null;

                if (!room.setup.onboardingComplete) {
                  return (
                    <div className="grid gap-3 lg:[grid-template-columns:20rem_minmax(0,1fr)] items-start">
                      <RoomOnboardingPanel
                        key={`${room.id}-${activeUnit}-${room.setup.onboardingStep}-${room.roomWidthCm}-${room.roomHeightCm}-${room.setup.windowDraftWidthCm}`}
                        room={room}
                        unit={activeUnit}
                        selectedItem={editingItem}
                        onSetStep={(step) => {
                          setActiveRoom(room.id);
                          handleOnboardingStep(room.id, step);
                        }}
                        onApplyDimensions={(widthCm, heightCm) => {
                          setActiveRoom(room.id);
                          handleOnboardingDimensions(room.id, widthCm, heightCm);
                        }}
                        onAddOpening={(type, windowWidthCm) => {
                          setActiveRoom(room.id);
                          handleOnboardingAddOpening(room.id, type, windowWidthCm);
                        }}
                        onRemoveSelected={() => {
                          setActiveRoom(room.id);
                          removeSelectedItem(room.id);
                        }}
                        onUpdateItem={(item) => {
                          setActiveRoom(room.id);
                          updateRoomItem(room.id, item);
                        }}
                        onUpdateDoorDefaults={(field, value) => {
                          setActiveRoom(room.id);
                          handleOnboardingDoorDefaults(room.id, field, value);
                        }}
                        onUpdateWindowDraftWidthCm={(widthCm) => {
                          handleOnboardingWindowDraft(room.id, widthCm);
                        }}
                        onFinish={() => {
                          setActiveRoom(room.id);
                          handleOnboardingFinish(room.id);
                        }}
                      />
                      <RoomCanvas
                        items={room.items}
                        onItemsChange={(update) => handleRoomItemsChange(room.id, update)}
                        onEditItem={(itemId) => handleRoomItemSelection(room.id, itemId)}
                        selectedItemId={room.editingItemId}
                        roomWidthCm={room.roomWidthCm}
                        roomHeightCm={room.roomHeightCm}
                        allowResize={false}
                        gridSize={workspace.preferences.gridSize}
                        gridColor={workspace.preferences.gridColor}
                        unit={activeUnit}
                        onLayoutInteractionStart={handleLayoutInteractionStart}
                        onLayoutInteractionEnd={handleLayoutInteractionEnd}
                        exportRoomId={room.id}
                      />
                    </div>
                  );
                }

                return (
                  <RoomCanvas
                    items={room.items}
                    onItemsChange={(update) => handleRoomItemsChange(room.id, update)}
                    onEditItem={(itemId) => handleRoomItemSelection(room.id, itemId)}
                    selectedItemId={room.editingItemId}
                    roomWidthCm={room.roomWidthCm}
                    roomHeightCm={room.roomHeightCm}
                    onRoomSizeChange={(widthCm, heightCm) => handleRoomSizeChange(room.id, widthCm, heightCm)}
                    gridSize={workspace.preferences.gridSize}
                    gridColor={workspace.preferences.gridColor}
                    unit={activeUnit}
                    onLayoutInteractionStart={handleLayoutInteractionStart}
                    onLayoutInteractionEnd={handleLayoutInteractionEnd}
                    exportRoomId={room.id}
                    allowResize={isActive}
                  />
                );
              }}
            />
          </section>
        </div>

        {(isAddPanelOpen || isEditPanelOpen) && (
          <button
            className="drawer-backdrop"
            aria-label="Close side panels"
            onClick={() => {
              setIsAddPanelOpen(false);
              setIsEditPanelOpen(false);
            }}
          />
        )}

        <aside className={`side-drawer side-drawer-left ${isAddPanelOpen ? 'open' : ''}`}>
          <div className="side-drawer-content">
            <div className="side-drawer-header">
              <h3 className="text-lg font-semibold text-slate-900">Add Objects</h3>
              <button
                className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs"
                onClick={() => setIsAddPanelOpen(false)}
              >
                Close
              </button>
            </div>
            {activeRoom && activeRoom.setup.onboardingComplete ? (
              <AddObjectPanel onAddObject={handleAddObjectToActiveRoom} unit={workspace.preferences.unit} />
            ) : (
              <div className="surface-card panel-shell p-4 sm:p-5">
                <p className="text-sm text-slate-600">
                  Complete onboarding for the active room before adding furniture.
                </p>
              </div>
            )}
          </div>
        </aside>

        <aside className={`side-drawer side-drawer-right ${isEditPanelOpen ? 'open' : ''}`}>
          <div className="side-drawer-content">
            <div className="side-drawer-header">
              <h3 className="text-lg font-semibold text-slate-900">Edit Object</h3>
              <button
                className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs"
                onClick={() => setIsEditPanelOpen(false)}
              >
                Close
              </button>
            </div>
            {activeRoom && activeRoom.setup.onboardingComplete ? (
              activeEditingItem ? (
                <EditObjectPanel
                  item={activeEditingItem}
                  onClose={() => setIsEditPanelOpen(false)}
                  onChange={handleEditItemInActiveRoom}
                  onRemove={handleRemoveActiveSelection}
                  unit={activeUnit}
                />
              ) : (
                <div className="surface-card panel-shell p-4 sm:p-5">
                  <p className="text-sm text-slate-600">
                    Select an object in the active room to edit size, position, or rotation.
                  </p>
                </div>
              )
            ) : (
              <div className="surface-card panel-shell p-4 sm:p-5">
                <p className="text-sm text-slate-600">
                  Object editing is available after onboarding is complete for the active room.
                </p>
              </div>
            )}
          </div>
        </aside>

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

export default App;
