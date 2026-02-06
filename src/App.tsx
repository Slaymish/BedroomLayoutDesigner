import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import AddObjectPanel from './components/AddObjectPanel'
import RoomCanvas from './components/RoomCanvas'
import EditObjectPanel from './components/EditObjectPanel'
import PreferencesPanel from './components/PreferencesPanel'
import type { OpeningWall, RoomItem, Preferences } from './types'
import { fromBaseCm, toBaseCm, type Unit } from './utils/units'
import {
  inferNearestWall,
  inferWallFromRotation,
  isOpening,
  normalizeOpeningOnWall,
} from './utils/openings'

type OnboardingStep = 'welcome' | 'dimensions' | 'openings'

interface StoredLayoutState {
  version: number;
  onboardingComplete: boolean;
  onboardingStep: OnboardingStep;
  roomWidthCm: number;
  roomHeightCm: number;
  items: RoomItem[];
  preferences: Preferences;
  nextItemId: number;
}

interface AddItemOptions {
  select?: boolean;
  x?: number;
  y?: number;
  rotate?: number;
  doorOpenDirection?: 'in' | 'out';
  doorOpenSide?: 'left' | 'right';
}

const STORAGE_KEY = 'bedroom-layout-designer:v1';
const STORAGE_VERSION = 2;
const DEFAULT_ROOM_WIDTH_CM = 360;
const DEFAULT_ROOM_HEIGHT_CM = 320;

const OPENING_PRESETS: Record<'Door' | 'Window', { widthCm: number; heightCm: number }> = {
  Door: { widthCm: 80, heightCm: 10 },
  Window: { widthCm: 100, heightCm: 10 },
};

const UNIT_OPTIONS: Unit[] = ['mm', 'cm', 'm', 'in', 'ft'];
const DEFAULT_PREFERENCES: Preferences = {
  gridSize: 30,
  gridColor: '#c8d2dd',
  unit: 'cm'
};

const toDimensionInputValue = (valueCm: number, unit: Unit): string => {
  const converted = fromBaseCm(valueCm, unit);
  const decimals = unit === 'm' || unit === 'ft' ? 2 : 1;
  return Number(converted.toFixed(decimals)).toString();
};

const isValidUnit = (unit: string | undefined): unit is Unit =>
  !!unit && UNIT_OPTIONS.includes(unit as Unit);

const isValidOpeningWall = (wall: string | undefined): wall is OpeningWall =>
  wall === 'top' || wall === 'right' || wall === 'bottom' || wall === 'left';

const normalizeOpeningForRoom = (
  item: RoomItem,
  roomWidthCm: number,
  roomHeightCm: number
): RoomItem => {
  const wall =
    inferWallFromRotation(item.rotate) ||
    (isValidOpeningWall(item.openingWall) ? item.openingWall : null) ||
    inferNearestWall(item.x + item.width / 2, item.y + item.height / 2, roomWidthCm, roomHeightCm);
  return normalizeOpeningOnWall(
    {
      ...item,
      doorOpenDirection: item.type === 'Door' ? (item.doorOpenDirection || 'in') : item.doorOpenDirection,
      doorOpenSide: item.type === 'Door' ? (item.doorOpenSide || 'left') : item.doorOpenSide,
    },
    wall,
    roomWidthCm,
    roomHeightCm
  );
};

function App() {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const nextItemId = useRef(1);
  const [roomWidthCm, setRoomWidthCm] = useState(DEFAULT_ROOM_WIDTH_CM);
  const [roomHeightCm, setRoomHeightCm] = useState(DEFAULT_ROOM_HEIGHT_CM);
  const [isHydrated, setIsHydrated] = useState(false);

  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const activeUnit: Unit = preferences.unit || 'cm';
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('welcome');
  const [dimensionDraft, setDimensionDraft] = useState({
    width: toDimensionInputValue(DEFAULT_ROOM_WIDTH_CM, activeUnit),
    height: toDimensionInputValue(DEFAULT_ROOM_HEIGHT_CM, activeUnit),
  });
  const [onboardingWindowDraft, setOnboardingWindowDraft] = useState({
    width: toDimensionInputValue(OPENING_PRESETS.Window.widthCm, activeUnit),
  });
  const [onboardingDoorDefaults, setOnboardingDoorDefaults] = useState<{
    doorOpenDirection: 'in' | 'out';
    doorOpenSide: 'left' | 'right';
  }>({
    doorOpenDirection: 'in',
    doorOpenSide: 'left',
  });
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handlePreferencesChange = (newPreferences: Preferences) => {
    setPreferences(newPreferences);
  };

  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false);

  useEffect(() => {
    try {
      const rawState = window.localStorage.getItem(STORAGE_KEY);
      if (!rawState) {
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(rawState) as Partial<StoredLayoutState>;
      if (parsed.version !== 1 && parsed.version !== STORAGE_VERSION) {
        setIsHydrated(true);
        return;
      }

      const loadedUnit = isValidUnit(parsed.preferences?.unit) ? parsed.preferences?.unit : 'cm';
      const loadedRoomWidth = typeof parsed.roomWidthCm === 'number' && parsed.roomWidthCm > 100 ? parsed.roomWidthCm : DEFAULT_ROOM_WIDTH_CM;
      const loadedRoomHeight = typeof parsed.roomHeightCm === 'number' && parsed.roomHeightCm > 100 ? parsed.roomHeightCm : DEFAULT_ROOM_HEIGHT_CM;

      setRoomWidthCm(loadedRoomWidth);
      setRoomHeightCm(loadedRoomHeight);
      setPreferences({
        gridSize: typeof parsed.preferences?.gridSize === 'number' ? Math.max(2, parsed.preferences.gridSize) : DEFAULT_PREFERENCES.gridSize,
        gridColor: parsed.preferences?.gridColor || DEFAULT_PREFERENCES.gridColor,
        unit: loadedUnit,
      });

      if (Array.isArray(parsed.items)) {
        const migratedItems = parsed.items.map(item => {
          if (!isOpening(item)) return item;
          return normalizeOpeningForRoom(item, loadedRoomWidth, loadedRoomHeight);
        });
        setItems(migratedItems);
        const highestId = migratedItems.reduce((max, item) => Math.max(max, item.id), 0);
        nextItemId.current = Math.max(highestId + 1, parsed.nextItemId || 1);
      } else if (typeof parsed.nextItemId === 'number' && parsed.nextItemId > 0) {
        nextItemId.current = parsed.nextItemId;
      }

      const complete = typeof parsed.onboardingComplete === 'boolean'
        ? parsed.onboardingComplete
        : Array.isArray(parsed.items) && parsed.items.length > 0;
      setOnboardingComplete(complete);

      if (!complete && parsed.onboardingStep) {
        setOnboardingStep(parsed.onboardingStep);
      }
      setDimensionDraft({
        width: toDimensionInputValue(loadedRoomWidth, loadedUnit),
        height: toDimensionInputValue(loadedRoomHeight, loadedUnit),
      });
      setOnboardingWindowDraft({
        width: toDimensionInputValue(OPENING_PRESETS.Window.widthCm, loadedUnit),
      });
    } catch {
      // If local storage is malformed, fall back to defaults.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const snapshot: StoredLayoutState = {
      version: STORAGE_VERSION,
      onboardingComplete,
      onboardingStep,
      roomWidthCm,
      roomHeightCm,
      items,
      preferences,
      nextItemId: Math.max(nextItemId.current, ...items.map(item => item.id + 1), 1),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [isHydrated, onboardingComplete, onboardingStep, roomWidthCm, roomHeightCm, items, preferences]);

  const handleAddItem = (width: number, height: number, type: string, options?: AddItemOptions) => {
    const newId = nextItemId.current++;
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
        : {})
    };

    setItems(prevItems => {
      const offset = 36 + (prevItems.length % 8) * 22;
      const requestedX = options?.x ?? offset;
      const requestedY = options?.y ?? offset;
      const draftItem = { ...newItem, x: requestedX, y: requestedY };

      if (isOpening(draftItem)) {
        const inferredWall =
          (typeof options?.rotate === 'number' ? inferWallFromRotation(options.rotate) : null) ||
          inferNearestWall(
            requestedX + draftItem.width / 2,
            requestedY + draftItem.height / 2,
            roomWidthCm,
            roomHeightCm
          );
        return [...prevItems, normalizeOpeningOnWall(draftItem, inferredWall, roomWidthCm, roomHeightCm)];
      }

      const safeX = Math.max(0, Math.min(requestedX, roomWidthCm - width));
      const safeY = Math.max(0, Math.min(requestedY, roomHeightCm - height));
      return [...prevItems, { ...draftItem, x: safeX, y: safeY }];
    });
    if (options?.select ?? true) {
      setEditingItemId(newId);
    }
  };

  const handleEditItem = (id: number | null) => {
    setEditingItemId(id);
  };

  const handleUpdateItem = (updatedItem: RoomItem) => {
    setItems(prevItems =>
      prevItems.map(existing => {
        if (existing.id !== updatedItem.id) return existing;
        if (!isOpening(updatedItem)) return updatedItem;
        return normalizeOpeningForRoom(updatedItem, roomWidthCm, roomHeightCm);
      })
    );
  };

  const handleRemoveItem = () => {
    if (editingItemId !== null) {
      setItems(prevItems => prevItems.filter(i => i.id !== editingItemId));
      setEditingItemId(null);
    }
  };

  const handleRoomSizeChange = useCallback((nextWidthCm: number, nextHeightCm: number) => {
    setRoomWidthCm(current => (current === nextWidthCm ? current : nextWidthCm));
    setRoomHeightCm(current => (current === nextHeightCm ? current : nextHeightCm));
  }, []);

  useEffect(() => {
    setItems(prevItems => {
      let changed = false;
      const normalizedItems = prevItems.map(item => {
        if (!isOpening(item)) return item;
        const normalized = normalizeOpeningForRoom(item, roomWidthCm, roomHeightCm);
        if (
          normalized.x !== item.x ||
          normalized.y !== item.y ||
          normalized.width !== item.width ||
          normalized.height !== item.height ||
          normalized.rotate !== item.rotate ||
          normalized.openingWall !== item.openingWall
        ) {
          changed = true;
        }
        return normalized;
      });
      return changed ? normalizedItems : prevItems;
    });
  }, [roomWidthCm, roomHeightCm]);

  const handleResetSetup = () => {
    const confirmed = window.confirm('Reset room setup and start onboarding again? This removes your current layout from this browser.');
    if (!confirmed) return;

    window.localStorage.removeItem(STORAGE_KEY);
    nextItemId.current = 1;
    setItems([]);
    setEditingItemId(null);
    setRoomWidthCm(DEFAULT_ROOM_WIDTH_CM);
    setRoomHeightCm(DEFAULT_ROOM_HEIGHT_CM);
    setPreferences(DEFAULT_PREFERENCES);
    setDimensionDraft({
      width: toDimensionInputValue(DEFAULT_ROOM_WIDTH_CM, 'cm'),
      height: toDimensionInputValue(DEFAULT_ROOM_HEIGHT_CM, 'cm'),
    });
    setOnboardingWindowDraft({
      width: toDimensionInputValue(OPENING_PRESETS.Window.widthCm, 'cm'),
    });
    setOnboardingDoorDefaults({
      doorOpenDirection: 'in',
      doorOpenSide: 'left',
    });
    setOnboardingError(null);
    setOnboardingStep('welcome');
    setOnboardingComplete(false);
    setPreferencesPanelOpen(false);
  };

  const startOnboarding = () => {
    setOnboardingError(null);
    setDimensionDraft({
      width: toDimensionInputValue(roomWidthCm, activeUnit),
      height: toDimensionInputValue(roomHeightCm, activeUnit),
    });
    setOnboardingStep('dimensions');
  };

  const handleDimensionUnitChange = (newUnit: Unit) => {
    const widthRaw = parseFloat(dimensionDraft.width);
    const heightRaw = parseFloat(dimensionDraft.height);
    const windowWidthRaw = parseFloat(onboardingWindowDraft.width);
    const widthCm = Number.isFinite(widthRaw) ? toBaseCm(widthRaw, activeUnit) : roomWidthCm;
    const heightCm = Number.isFinite(heightRaw) ? toBaseCm(heightRaw, activeUnit) : roomHeightCm;
    const windowWidthCm = Number.isFinite(windowWidthRaw) ? toBaseCm(windowWidthRaw, activeUnit) : OPENING_PRESETS.Window.widthCm;

    setPreferences(prev => ({ ...prev, unit: newUnit }));
    setDimensionDraft({
      width: toDimensionInputValue(widthCm, newUnit),
      height: toDimensionInputValue(heightCm, newUnit),
    });
    setOnboardingWindowDraft({
      width: toDimensionInputValue(windowWidthCm, newUnit),
    });
  };

  const goToOpeningPlacement = () => {
    const widthValue = parseFloat(dimensionDraft.width);
    const heightValue = parseFloat(dimensionDraft.height);

    if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
      setOnboardingError('Please enter valid room dimensions.');
      return;
    }

    const widthCm = Math.round(toBaseCm(widthValue, activeUnit));
    const heightCm = Math.round(toBaseCm(heightValue, activeUnit));
    if (widthCm < 180 || heightCm < 180) {
      setOnboardingError(`Room dimensions are too small. Use at least 180cm x 180cm.`);
      return;
    }

    setRoomWidthCm(widthCm);
    setRoomHeightCm(heightCm);
    setItems(prevItems =>
      prevItems
        .filter(item => item.type === 'Door' || item.type === 'Window')
        .map(item => normalizeOpeningForRoom(item, widthCm, heightCm))
    );
    setEditingItemId(null);
    setOnboardingError(null);
    setOnboardingStep('openings');
  };

  const addOpening = (type: 'Door' | 'Window') => {
    let openingWidthCm = OPENING_PRESETS[type].widthCm;
    let openingHeightCm = OPENING_PRESETS[type].heightCm;

    if (type === 'Window') {
      const widthRaw = parseFloat(onboardingWindowDraft.width);
      const convertedWidth = Number.isFinite(widthRaw) ? toBaseCm(widthRaw, activeUnit) : NaN;

      if (!Number.isFinite(convertedWidth) || convertedWidth <= 0) {
        setOnboardingError('Enter a valid window size before adding a window.');
        return;
      }

      openingWidthCm = Math.round(convertedWidth);
      openingHeightCm = OPENING_PRESETS.Window.heightCm;
    }

    const spawnX = Math.max(0, roomWidthCm / 2 - openingWidthCm / 2);
    const spawnY = type === 'Door'
      ? Math.max(0, roomHeightCm - openingHeightCm / 2)
      : Math.max(0, openingHeightCm);

    handleAddItem(openingWidthCm, openingHeightCm, type, {
      x: spawnX,
      y: spawnY,
      doorOpenDirection: type === 'Door' ? onboardingDoorDefaults.doorOpenDirection : undefined,
      doorOpenSide: type === 'Door' ? onboardingDoorDefaults.doorOpenSide : undefined,
    });
    setOnboardingError(null);
  };

  const handleOnboardingDoorSettingChange = (
    field: 'doorOpenDirection' | 'doorOpenSide',
    value: 'in' | 'out' | 'left' | 'right'
  ) => {
    const selectedDoor = editingItem?.type === 'Door' ? editingItem : null;
    if (selectedDoor) {
      if (field === 'doorOpenDirection') {
        handleUpdateItem({
          ...selectedDoor,
          doorOpenDirection: value as 'in' | 'out',
        });
      } else {
        handleUpdateItem({
          ...selectedDoor,
          doorOpenSide: value as 'left' | 'right',
        });
      }
      return;
    }

    if (field === 'doorOpenDirection') {
      setOnboardingDoorDefaults(prev => ({
        ...prev,
        doorOpenDirection: value as 'in' | 'out',
      }));
    } else {
      setOnboardingDoorDefaults(prev => ({
        ...prev,
        doorOpenSide: value as 'left' | 'right',
      }));
    }
  };

  const finishOnboarding = () => {
    const doorCount = items.filter(item => item.type === 'Door').length;
    if (doorCount < 1) {
      setOnboardingError('Add at least one door before finishing setup.');
      return;
    }

    setOnboardingError(null);
    setEditingItemId(null);
    setOnboardingComplete(true);
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setExportError(null);
    setIsExportingPdf(true);

    try {
      const exportTarget = document.querySelector<HTMLElement>('[data-floorplan-export="true"]');
      if (!exportTarget) {
        throw new Error('Could not find the floorplan to export.');
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(exportTarget, {
        backgroundColor: '#ffffff',
        scale: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
        useCORS: true,
        logging: false,
      });

      const roomWidth = fromBaseCm(roomWidthCm, activeUnit);
      const roomHeight = fromBaseCm(roomHeightCm, activeUnit);
      const decimals = activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1;
      const roomSizeLabel = `${roomWidth.toFixed(decimals)}${activeUnit} x ${roomHeight.toFixed(decimals)}${activeUnit}`;
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const headerHeight = 58;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2 - headerHeight;
      const renderScale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
      const renderWidth = canvas.width * renderScale;
      const renderHeight = canvas.height * renderScale;
      const renderX = (pageWidth - renderWidth) / 2;
      const renderY = margin + headerHeight + Math.max(0, (availableHeight - renderHeight) / 2);

      pdf.setFontSize(14);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Bedroom Layout Floorplan', margin, margin + 14);
      pdf.setFontSize(10);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Room dimensions: ${roomSizeLabel}`, margin, margin + 32);
      pdf.text(`Exported: ${new Date().toLocaleString()}`, margin, margin + 46);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', renderX, renderY, renderWidth, renderHeight, undefined, 'FAST');
      pdf.save(`bedroom-floorplan-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export PDF.';
      setExportError(message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const editingItem = useMemo(
    () => (editingItemId !== null ? items.find(i => i.id === editingItemId) || null : null),
    [editingItemId, items]
  );

  const doorCount = items.filter(item => item.type === 'Door').length;
  const windowCount = items.filter(item => item.type === 'Window').length;
  const selectedDoorInOnboarding = onboardingComplete ? null : (editingItem?.type === 'Door' ? editingItem : null);
  const onboardingDoorDirection = selectedDoorInOnboarding?.doorOpenDirection ?? onboardingDoorDefaults.doorOpenDirection;
  const onboardingDoorSide = selectedDoorInOnboarding?.doorOpenSide ?? onboardingDoorDefaults.doorOpenSide;

  if (!isHydrated) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center px-6">
        <div className="surface-card p-6 text-slate-700">
          Loading your layout...
        </div>
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <div className="min-h-screen app-shell">
      <header className="app-header px-4 py-5 sm:px-6 md:px-8 md:py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">Bedroom Layout Designer</h1>
        </div>
      </header>
        <main className="px-4 py-5 sm:px-6 md:px-8 md:py-7">
          <div className="mx-auto max-w-6xl">
            {onboardingStep === 'welcome' && (
              <section className="surface-card p-5 sm:p-6 md:p-7">
                <p className="badge-step">Step 1 of 3</p>
                <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900">Welcome, ready to design your bedroom?</h2>
                <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                  You will set room dimensions, place doors and windows, then start arranging furniture.
                </p>
                <button
                  className="ui-btn ui-btn-primary mt-6"
                  onClick={startOnboarding}
                >
                  Start Setup
                </button>
              </section>
            )}

            {onboardingStep === 'dimensions' && (
              <section className="surface-card p-5 sm:p-6 md:p-7">
                <p className="badge-step">Step 2 of 3</p>
                <h2 className="mt-4 text-xl sm:text-2xl font-bold text-slate-900">What are your bedroom dimensions?</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="ui-field">
                    <label className="ui-label">Width</label>
                    <input
                      className="ui-input"
                      type="number"
                      value={dimensionDraft.width}
                      min={1}
                      step={0.1}
                      onChange={(e) => setDimensionDraft(prev => ({ ...prev, width: e.target.value }))}
                    />
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">Depth</label>
                    <input
                      className="ui-input"
                      type="number"
                      value={dimensionDraft.height}
                      min={1}
                      step={0.1}
                      onChange={(e) => setDimensionDraft(prev => ({ ...prev, height: e.target.value }))}
                    />
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">Unit</label>
                    <select
                      className="ui-select"
                      value={activeUnit}
                      onChange={(e) => handleDimensionUnitChange(e.target.value as Unit)}
                    >
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {onboardingError && <p className="mt-3 text-sm text-rose-600">{onboardingError}</p>}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="ui-btn ui-btn-ghost"
                    onClick={() => setOnboardingStep('welcome')}
                  >
                    Back
                  </button>
                  <button
                    className="ui-btn ui-btn-primary"
                    onClick={goToOpeningPlacement}
                  >
                    Continue
                  </button>
                </div>
              </section>
            )}

            {onboardingStep === 'openings' && (
              <section className="grid gap-4 xl:[grid-template-columns:20rem_minmax(0,1fr)] items-start">
                <div className="surface-card panel-shell p-4 sm:p-5 space-y-4">
                  <p className="badge-step">Step 3 of 3</p>
                  <h2 className="text-xl font-bold text-slate-900">Place doors and windows</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="ui-btn ui-btn-primary" onClick={() => addOpening('Door')}>Add Door</button>
                    <button className="ui-btn ui-btn-secondary" onClick={() => addOpening('Window')}>Add Window</button>
                    <button className="ui-btn ui-btn-ghost disabled:opacity-40" onClick={handleRemoveItem} disabled={!editingItem}>Remove</button>
                  </div>
                  <div className="surface-card-muted p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Window</p>
                    <div className="ui-field">
                      <label className="ui-label">Width ({activeUnit})</label>
                      <input
                        className="ui-input"
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={onboardingWindowDraft.width}
                        onChange={(e) => setOnboardingWindowDraft(prev => ({ ...prev, width: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="surface-card-muted p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {selectedDoorInOnboarding ? 'Selected Door Swing' : 'Default Door Swing'}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="ui-field">
                        <label className="ui-label">Open Direction</label>
                        <select
                          className="ui-select"
                          value={onboardingDoorDirection}
                          onChange={(e) => handleOnboardingDoorSettingChange('doorOpenDirection', e.target.value as 'in' | 'out')}
                        >
                          <option value="in">In</option>
                          <option value="out">Out</option>
                        </select>
                      </div>
                      <div className="ui-field">
                        <label className="ui-label">Hinge Side</label>
                        <select
                          className="ui-select"
                          value={onboardingDoorSide}
                          onChange={(e) => handleOnboardingDoorSettingChange('doorOpenSide', e.target.value as 'left' | 'right')}
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    Doors: <span className="font-semibold text-slate-800">{doorCount}</span> · Windows: <span className="font-semibold text-slate-800">{windowCount}</span>
                  </p>
                  {onboardingError && <p className="text-sm text-rose-600">{onboardingError}</p>}
                  <div className="flex flex-wrap gap-3">
                    <button className="ui-btn ui-btn-ghost" onClick={() => setOnboardingStep('dimensions')}>Back</button>
                    <button className="ui-btn ui-btn-primary" onClick={finishOnboarding}>Start Designing</button>
                  </div>
                </div>
                <div className="panel-shell min-w-0">
                  <RoomCanvas
                    items={items}
                    onItemsChange={setItems}
                    onEditItem={setEditingItemId}
                    selectedItemId={editingItem?.id ?? null}
                    roomWidthCm={roomWidthCm}
                    roomHeightCm={roomHeightCm}
                    allowResize={false}
                    gridSize={preferences.gridSize}
                    gridColor={preferences.gridColor}
                    unit={activeUnit}
                  />
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shell">
      <header className="app-header px-4 py-5 sm:px-6 md:px-8 md:py-6">
        <div className="mx-auto max-w-[1440px] flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900">Bedroom Layout Designer</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="ui-btn ui-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              className="ui-btn ui-btn-ghost"
              onClick={() => setPreferencesPanelOpen(true)}
            >
              Preferences
            </button>
          </div>
        </div>
      </header>
      <main className="px-4 py-5 sm:px-6 md:px-8 md:py-7 overflow-x-clip">
        {exportError && (
          <p className="mx-auto mb-3 max-w-[1440px] text-sm text-rose-600">{exportError}</p>
        )}
        <div className="mx-auto max-w-[1440px] grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:[grid-template-columns:17.5rem_minmax(0,1fr)_19.5rem] items-start">
          <section className="order-1 md:col-span-2 xl:col-span-1 xl:col-start-2 panel-shell min-w-0">
            <RoomCanvas
              items={items}
              onItemsChange={setItems}
              onEditItem={handleEditItem}
              selectedItemId={editingItem?.id ?? null}
              roomWidthCm={roomWidthCm}
              roomHeightCm={roomHeightCm}
              onRoomSizeChange={handleRoomSizeChange}
              gridSize={preferences.gridSize}
              gridColor={preferences.gridColor}
              unit={activeUnit}
            />
          </section>
          <section className="order-2 panel-shell min-w-0 xl:col-start-1 xl:row-start-1">
            <AddObjectPanel onAddObject={handleAddItem} unit={preferences.unit} />
          </section>
          <section className="order-3 panel-shell min-w-0 xl:col-start-3 xl:row-start-1">
            {editingItem ? (
              <EditObjectPanel
                item={editingItem}
                onClose={() => setEditingItemId(null)}
                onChange={handleUpdateItem}
                onRemove={handleRemoveItem}
                unit={activeUnit}
              />
            ) : (
              <div className="surface-card panel-shell p-4 sm:p-5">
                <h3 className="text-lg font-semibold text-slate-900">Edit Object</h3>
                <p className="mt-2 text-sm text-slate-600">Select any object on the canvas to edit size, position, or rotation.</p>
              </div>
            )}
          </section>
        </div>
        {preferencesPanelOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[1px]">
            <div className="modal-shell p-5 w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Layout Preferences</h2>
                <button
                  className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs"
                  onClick={() => setPreferencesPanelOpen(false)}
                >
                  Close
                </button>
              </div>
              <PreferencesPanel
                onChange={handlePreferencesChange}
                preferences={preferences}
                onResetSetup={handleResetSetup}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
