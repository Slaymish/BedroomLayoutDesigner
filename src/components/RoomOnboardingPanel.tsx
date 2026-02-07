import { memo, useMemo, useState } from 'react';
import type { RoomDesign, RoomItem } from '../types';
import { fromBaseCm, toBaseCm, type Unit } from '../utils/units';

interface RoomOnboardingPanelProps {
  room: RoomDesign;
  unit: Unit;
  selectedItem: RoomItem | null;
  onSetStep: (step: RoomDesign['setup']['onboardingStep']) => void;
  onApplyDimensions: (widthCm: number, heightCm: number) => void;
  onAddOpening: (type: 'Door' | 'Window', windowWidthCm?: number) => void;
  onRemoveSelected: () => void;
  onUpdateItem: (item: RoomItem) => void;
  onUpdateDoorDefaults: (
    field: 'doorOpenDirection' | 'doorOpenSide',
    value: 'in' | 'out' | 'left' | 'right'
  ) => void;
  onUpdateWindowDraftWidthCm: (widthCm: number) => void;
  onFinish: () => void;
}

const toDimensionInputValue = (valueCm: number, unit: Unit): string => {
  const converted = fromBaseCm(valueCm, unit);
  const decimals = unit === 'm' || unit === 'ft' ? 2 : 1;
  return Number(converted.toFixed(decimals)).toString();
};

function RoomOnboardingPanel({
  room,
  unit,
  selectedItem,
  onSetStep,
  onApplyDimensions,
  onAddOpening,
  onRemoveSelected,
  onUpdateItem,
  onUpdateDoorDefaults,
  onUpdateWindowDraftWidthCm,
  onFinish,
}: RoomOnboardingPanelProps) {
  const [dimensionDraft, setDimensionDraft] = useState({
    width: toDimensionInputValue(room.roomWidthCm, unit),
    height: toDimensionInputValue(room.roomHeightCm, unit),
  });
  const [windowDraft, setWindowDraft] = useState({
    width: toDimensionInputValue(room.setup.windowDraftWidthCm, unit),
  });
  const [error, setError] = useState<string | null>(null);

  const doorCount = useMemo(
    () => room.items.filter((item) => item.type === 'Door').length,
    [room.items]
  );
  const windowCount = useMemo(
    () => room.items.filter((item) => item.type === 'Window').length,
    [room.items]
  );
  const selectedDoor = selectedItem?.type === 'Door' ? selectedItem : null;
  const doorDirection = selectedDoor?.doorOpenDirection ?? room.setup.doorDefaults.doorOpenDirection;
  const doorSide = selectedDoor?.doorOpenSide ?? room.setup.doorDefaults.doorOpenSide;

  const goToOpenings = () => {
    const widthValue = parseFloat(dimensionDraft.width);
    const heightValue = parseFloat(dimensionDraft.height);
    if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
      setError('Please enter valid room dimensions.');
      return;
    }

    const widthCm = Math.round(toBaseCm(widthValue, unit));
    const heightCm = Math.round(toBaseCm(heightValue, unit));
    if (widthCm < 180 || heightCm < 180) {
      setError('Room dimensions are too small. Use at least 180cm x 180cm.');
      return;
    }

    onApplyDimensions(widthCm, heightCm);
    onSetStep('openings');
    setError(null);
  };

  const addOpening = (type: 'Door' | 'Window') => {
    if (type === 'Door') {
      onAddOpening('Door');
      setError(null);
      return;
    }

    const widthRaw = parseFloat(windowDraft.width);
    const convertedWidth = Number.isFinite(widthRaw) ? toBaseCm(widthRaw, unit) : NaN;
    if (!Number.isFinite(convertedWidth) || convertedWidth <= 0) {
      setError('Enter a valid window size before adding a window.');
      return;
    }

    const widthCm = Math.round(convertedWidth);
    onUpdateWindowDraftWidthCm(widthCm);
    onAddOpening('Window', widthCm);
    setError(null);
  };

  const updateDoorSetting = (
    field: 'doorOpenDirection' | 'doorOpenSide',
    value: 'in' | 'out' | 'left' | 'right'
  ) => {
    if (selectedDoor) {
      if (field === 'doorOpenDirection') {
        onUpdateItem({ ...selectedDoor, doorOpenDirection: value as 'in' | 'out' });
      } else {
        onUpdateItem({ ...selectedDoor, doorOpenSide: value as 'left' | 'right' });
      }
      return;
    }
    onUpdateDoorDefaults(field, value);
  };

  const finish = () => {
    if (doorCount < 1) {
      setError('Add at least one door before finishing setup.');
      return;
    }
    onFinish();
    setError(null);
  };

  if (room.setup.onboardingStep === 'welcome') {
    return (
      <section className="surface-card p-4 sm:p-5">
        <p className="badge-step">Step 1 of 3</p>
        <h3 className="mt-3 text-lg font-bold text-slate-900">Set up {room.name}</h3>
        <p className="mt-1 text-sm text-slate-600">
          Add dimensions, doors, and windows before furniture editing.
        </p>
        <button className="ui-btn ui-btn-primary mt-4" onClick={() => onSetStep('dimensions')}>
          Start Setup
        </button>
      </section>
    );
  }

  if (room.setup.onboardingStep === 'dimensions') {
    return (
      <section className="surface-card p-4 sm:p-5">
        <p className="badge-step">Step 2 of 3</p>
        <h3 className="mt-3 text-lg font-bold text-slate-900">Room dimensions</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="ui-field">
            <label className="ui-label">Width ({unit})</label>
            <input
              className="ui-input"
              type="number"
              value={dimensionDraft.width}
              min={0.1}
              step={0.1}
              onChange={(event) => setDimensionDraft((prev) => ({ ...prev, width: event.target.value }))}
            />
          </div>
          <div className="ui-field">
            <label className="ui-label">Length ({unit})</label>
            <input
              className="ui-input"
              type="number"
              value={dimensionDraft.height}
              min={0.1}
              step={0.1}
              onChange={(event) => setDimensionDraft((prev) => ({ ...prev, height: event.target.value }))}
            />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="ui-btn ui-btn-ghost" onClick={() => onSetStep('welcome')}>
            Back
          </button>
          <button className="ui-btn ui-btn-primary" onClick={goToOpenings}>
            Continue
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-card p-4 sm:p-5 space-y-3">
      <p className="badge-step">Step 3 of 3</p>
      <h3 className="text-lg font-bold text-slate-900">Place doors and windows</h3>
      <div className="flex flex-wrap gap-2">
        <button className="ui-btn ui-btn-primary" onClick={() => addOpening('Door')}>
          Add Door
        </button>
        <button className="ui-btn ui-btn-secondary" onClick={() => addOpening('Window')}>
          Add Window
        </button>
        <button
          className="ui-btn ui-btn-ghost disabled:opacity-40"
          onClick={onRemoveSelected}
          disabled={!selectedItem}
        >
          Remove
        </button>
      </div>
      <div className="surface-card-muted p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Window</p>
        <div className="ui-field">
          <label className="ui-label">Width ({unit})</label>
          <input
            className="ui-input"
            type="number"
            min={0.1}
            step={0.1}
            value={windowDraft.width}
            onChange={(event) => setWindowDraft({ width: event.target.value })}
            onBlur={() => {
              const widthRaw = parseFloat(windowDraft.width);
              const convertedWidth = Number.isFinite(widthRaw) ? toBaseCm(widthRaw, unit) : NaN;
              if (Number.isFinite(convertedWidth) && convertedWidth > 0) {
                onUpdateWindowDraftWidthCm(Math.round(convertedWidth));
              }
            }}
          />
        </div>
      </div>
      <div className="surface-card-muted p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {selectedDoor ? 'Selected Door Swing' : 'Default Door Swing'}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="ui-field">
            <label className="ui-label">Open Direction</label>
            <select
              className="ui-select"
              value={doorDirection}
              onChange={(event) => updateDoorSetting('doorOpenDirection', event.target.value as 'in' | 'out')}
            >
              <option value="in">In</option>
              <option value="out">Out</option>
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Hinge Side</label>
            <select
              className="ui-select"
              value={doorSide}
              onChange={(event) => updateDoorSetting('doorOpenSide', event.target.value as 'left' | 'right')}
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Doors: <span className="font-semibold text-slate-800">{doorCount}</span> · Windows:{' '}
        <span className="font-semibold text-slate-800">{windowCount}</span> · Default window:{' '}
        <span className="font-semibold text-slate-800">{Math.round(room.setup.windowDraftWidthCm)}cm</span>
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="ui-btn ui-btn-ghost" onClick={() => onSetStep('dimensions')}>
          Back
        </button>
        <button className="ui-btn ui-btn-primary" onClick={finish}>
          Start Designing
        </button>
      </div>
    </section>
  );
}

const onboardingPanelPropsEqual = (
  prev: RoomOnboardingPanelProps,
  next: RoomOnboardingPanelProps
): boolean => (
  prev.room === next.room &&
  prev.unit === next.unit &&
  prev.selectedItem === next.selectedItem
);

export default memo(RoomOnboardingPanel, onboardingPanelPropsEqual);
