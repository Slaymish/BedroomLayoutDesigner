import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import AddObjectPanel from './components/AddObjectPanel'
import RoomCanvas from './components/RoomCanvas'
import EditObjectPanel from './components/EditObjectPanel'
import PreferencesPanel from './components/PreferencesPanel'
import type { RoomItem, Preferences } from './types'
import { fromBaseCm, toBaseCm, type Unit } from './utils/units'

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
}

const STORAGE_KEY = 'bedroom-layout-designer:v1';
const STORAGE_VERSION = 1;
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
const ONBOARDING_STEPS: Array<{ id: OnboardingStep; label: string }> = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'openings', label: 'Doors & Windows' },
];

const toDimensionInputValue = (valueCm: number, unit: Unit): string => {
  const converted = fromBaseCm(valueCm, unit);
  const decimals = unit === 'm' || unit === 'ft' ? 2 : 1;
  return Number(converted.toFixed(decimals)).toString();
};

const isValidUnit = (unit: string | undefined): unit is Unit =>
  !!unit && UNIT_OPTIONS.includes(unit as Unit);

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
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

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
      if (parsed.version !== STORAGE_VERSION) {
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
        setItems(parsed.items);
        const highestId = parsed.items.reduce((max, item) => Math.max(max, item.id), 0);
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
      ...(type === 'Door' ? { doorOpenDirection: 'in' as const, doorOpenSide: 'left' as const } : {})
    };

    setItems(prevItems => {
      const offset = 36 + (prevItems.length % 8) * 22;
      const requestedX = options?.x ?? offset;
      const requestedY = options?.y ?? offset;
      const safeX = Math.max(0, Math.min(requestedX, roomWidthCm - width));
      const safeY = Math.max(0, Math.min(requestedY, roomHeightCm - height));
      return [...prevItems, { ...newItem, x: safeX, y: safeY }];
    });
    if (options?.select ?? true) {
      setEditingItemId(newId);
    }
  };

  const handleEditItem = (id: number | null) => {
    setEditingItemId(id);
  };

  const handleUpdateItem = (updatedItem: RoomItem) => {
    setItems(prevItems => prevItems.map(i => i.id === updatedItem.id ? updatedItem : i));
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
    const widthCm = Number.isFinite(widthRaw) ? toBaseCm(widthRaw, activeUnit) : roomWidthCm;
    const heightCm = Number.isFinite(heightRaw) ? toBaseCm(heightRaw, activeUnit) : roomHeightCm;

    setPreferences(prev => ({ ...prev, unit: newUnit }));
    setDimensionDraft({
      width: toDimensionInputValue(widthCm, newUnit),
      height: toDimensionInputValue(heightCm, newUnit),
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
    setItems(prevItems => prevItems.filter(item => item.type === 'Door' || item.type === 'Window'));
    setEditingItemId(null);
    setOnboardingError(null);
    setOnboardingStep('openings');
  };

  const addOpening = (type: 'Door' | 'Window') => {
    const preset = OPENING_PRESETS[type];
    const spawnX = Math.max(0, roomWidthCm / 2 - preset.widthCm / 2);
    const spawnY = type === 'Door'
      ? Math.max(0, roomHeightCm - preset.heightCm / 2)
      : Math.max(0, preset.heightCm);
    handleAddItem(preset.widthCm, preset.heightCm, type, { x: spawnX, y: spawnY });
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

  const editingItem = useMemo(
    () => (editingItemId !== null ? items.find(i => i.id === editingItemId) || null : null),
    [editingItemId, items]
  );

  const doorCount = items.filter(item => item.type === 'Door').length;
  const windowCount = items.filter(item => item.type === 'Window').length;
  const onboardingStepIndex = ONBOARDING_STEPS.findIndex(step => step.id === onboardingStep);
  const onboardingProgressPct = `${Math.max(1, onboardingStepIndex + 1) / ONBOARDING_STEPS.length * 100}%`;
  const hasRequiredDoor = doorCount > 0;
  const hasAnyOpening = doorCount + windowCount > 0;

  if (!isHydrated) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-700">
          Loading your layout...
        </div>
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <div className="min-h-screen app-shell">
        <header className="px-5 py-8 md:px-8 md:py-10 border-b border-slate-200/70">
          <div className="mx-auto max-w-[1200px]">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Bedroom Layout Designer</h1>
            <p className="mt-2 text-sm md:text-base text-slate-600">Let&apos;s set up your room first, then you can start designing.</p>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Setup Progress</span>
                <span>{Math.max(1, onboardingStepIndex + 1)} / {ONBOARDING_STEPS.length}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: onboardingProgressPct }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ONBOARDING_STEPS.map((step, index) => {
                  const isActive = step.id === onboardingStep;
                  const isCompleted = index < onboardingStepIndex;
                  return (
                    <span
                      key={step.id}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium
                      ${isActive ? 'bg-amber-100 text-amber-900 border border-amber-200' : ''}
                      ${isCompleted ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : ''}
                      ${!isActive && !isCompleted ? 'bg-slate-100 text-slate-600 border border-slate-200' : ''}
                    `}
                    >
                      {isCompleted ? 'Done' : `Step ${index + 1}`}: {step.label}
                    </span>
                  );
                })}
              </div>
            </div>
            {onboardingStep === 'welcome' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Step 1 of 3</p>
                <h2 className="mt-4 text-3xl font-bold text-slate-900">Welcome, ready to design your bedroom?</h2>
                <p className="mt-3 text-slate-600 max-w-2xl">We&apos;ll quickly collect your room dimensions and place doors/windows first, so your layout is accurate from the start.</p>
                <button
                  className="mt-6 inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                  onClick={startOnboarding}
                >
                  Start Setup
                </button>
              </section>
            )}

            {onboardingStep === 'dimensions' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Step 2 of 3</p>
                <h2 className="mt-4 text-2xl font-bold text-slate-900">What are your bedroom dimensions?</h2>
                <p className="mt-2 text-slate-600">Enter the inside wall-to-wall measurements of your room.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-700">Width</label>
                    <input
                      className="border border-slate-300 rounded-lg px-3 py-2"
                      type="number"
                      value={dimensionDraft.width}
                      min={1}
                      step={0.1}
                      onChange={(e) => setDimensionDraft(prev => ({ ...prev, width: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-700">Depth</label>
                    <input
                      className="border border-slate-300 rounded-lg px-3 py-2"
                      type="number"
                      value={dimensionDraft.height}
                      min={1}
                      step={0.1}
                      onChange={(e) => setDimensionDraft(prev => ({ ...prev, height: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-700">Unit</label>
                    <select
                      className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
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
                    className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100"
                    onClick={() => setOnboardingStep('welcome')}
                  >
                    Back
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700"
                    onClick={goToOpeningPlacement}
                  >
                    Continue
                  </button>
                </div>
              </section>
            )}

            {onboardingStep === 'openings' && (
              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Step 3 of 3</p>
                  <h2 className="mt-4 text-2xl font-bold text-slate-900">Place doors and windows</h2>
                  <p className="mt-2 text-slate-600">Add openings, then drag them to the correct wall. They snap automatically.</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400"
                      onClick={() => addOpening('Door')}
                    >
                      Add Door
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold bg-sky-500 text-white hover:bg-sky-600"
                      onClick={() => addOpening('Window')}
                    >
                      Add Window
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      onClick={handleRemoveItem}
                      disabled={!editingItem}
                    >
                      Remove Selected
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Doors: <span className="font-semibold text-slate-800">{doorCount}</span> · Windows: <span className="font-semibold text-slate-800">{windowCount}</span>
                  </p>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Checklist</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li className={hasRequiredDoor ? 'text-emerald-700' : 'text-slate-700'}>
                        {hasRequiredDoor ? '✓' : '○'} Add at least one door (required)
                      </li>
                      <li className={hasAnyOpening ? 'text-emerald-700' : 'text-slate-700'}>
                        {hasAnyOpening ? '✓' : '○'} Place openings on the correct wall
                      </li>
                      <li className={windowCount > 0 ? 'text-emerald-700' : 'text-slate-700'}>
                        {windowCount > 0 ? '✓' : '○'} Add windows (optional)
                      </li>
                    </ul>
                  </div>
                  {onboardingError && <p className="mt-2 text-sm text-rose-600">{onboardingError}</p>}
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100"
                      onClick={() => setOnboardingStep('dimensions')}
                    >
                      Back
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700"
                      onClick={finishOnboarding}
                    >
                      Start Designing
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto pb-2">
                  <div className="inline-block">
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
      <header className="px-5 py-8 md:px-8 md:py-10 border-b border-slate-200/70">
        <div className="mx-auto max-w-[1500px]">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Bedroom Layout Designer</h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">Add furniture presets, drag to position, and fine-tune dimensions from the edit panel.</p>
        </div>
      </header>
      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1500px] grid grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_18rem] gap-5 lg:gap-6 items-start">
          <section className="w-full min-w-0">
            <AddObjectPanel onAddObject={handleAddItem} unit={preferences.unit} />
          </section>
          <section className="w-full min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Drag objects to move. Drag canvas edges to resize room.
            </div>
            <div className="overflow-x-auto pb-2 max-w-full">
              <div className="inline-block">
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
              </div>
            </div>
          </section>
          <section className="w-full min-w-0 xl:col-span-2 2xl:col-span-1">
            {editingItem ? (
              <div className="max-w-[22rem]">
                <EditObjectPanel
                  item={editingItem}
                  onClose={() => setEditingItemId(null)}
                  onChange={handleUpdateItem}
                  onRemove={handleRemoveItem}
                  unit={activeUnit}
                />
              </div>
            ) : (
              <div className="max-w-[22rem] p-4 border border-slate-200 bg-white rounded-2xl shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Edit Object</h3>
                <p className="mt-2 text-sm text-slate-600">Select any object on the canvas to edit size, position, or rotation.</p>
              </div>
            )}
          </section>
        </div>
        {preferencesPanelOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[1px]">
            <div className="bg-white p-5 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Layout Preferences</h2>
                <button
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
        {!preferencesPanelOpen && (
          <button
            className="fixed bottom-5 right-5 md:bottom-6 md:right-6 bg-slate-900 text-white rounded-full px-4 py-3 shadow-lg hover:bg-slate-700 transition-colors"
            onClick={() => setPreferencesPanelOpen(true)}
          >
            Preferences
          </button>
        )}
      </main>
    </div>
  )
}

export default App
