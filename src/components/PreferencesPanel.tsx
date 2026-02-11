import type { Preferences } from "../types";
import { fromBaseCm, toBaseCm } from "../utils/units";
import { useEffect, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

interface PreferencesPanelProps {
    onChange: (prefs: Preferences) => void;
    onGridSpacingPreviewChange?: (value: number | null) => void;
    preferences: Preferences;
    onResetSetup?: () => void;
    onSaveWorkspace?: () => void;
    onExportWorkspace?: () => void;
    onLoadWorkspace?: () => void;
    autosaveStatusLabel?: string;
}

export default function PreferencesPanel({
    onChange,
    onGridSpacingPreviewChange,
    preferences,
    onResetSetup,
    onSaveWorkspace,
    onExportWorkspace,
    onLoadWorkspace,
    autosaveStatusLabel,
}: PreferencesPanelProps) {
    const activeUnit = preferences.unit || 'cm';
    const [gridSpacingDraft, setGridSpacingDraft] = useState<string | null>(null);
    const [wallThicknessDraft, setWallThicknessDraft] = useState<string | null>(null);
    const gridSpacingInputValue = gridSpacingDraft ?? preferences.gridSpacing.toString();
    const wallThicknessInputValue = wallThicknessDraft ?? Number(
        fromBaseCm(preferences.wallThicknessCm, activeUnit).toFixed(activeUnit === 'm' || activeUnit === 'ft' ? 2 : 1)
    ).toString();

    useEffect(() => () => {
        onGridSpacingPreviewChange?.(null);
    }, [onGridSpacingPreviewChange]);

    const commitGridSpacing = (rawValue?: string) => {
        const normalized = (rawValue ?? gridSpacingInputValue).trim();
        if (!normalized) {
            setGridSpacingDraft(null);
            onGridSpacingPreviewChange?.(null);
            return;
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setGridSpacingDraft(null);
            onGridSpacingPreviewChange?.(null);
            return;
        }

        const newSpacing = Math.max(0.1, parsed);
        onChange({ ...preferences, gridSpacing: newSpacing });
        setGridSpacingDraft(null);
        onGridSpacingPreviewChange?.(null);
    };

    const handleGridSpacingKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitGridSpacing(event.currentTarget.value);
            event.currentTarget.blur();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            setGridSpacingDraft(null);
            onGridSpacingPreviewChange?.(null);
            event.currentTarget.blur();
        }
    };

    const handleGridColorChange = (e: ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value; // hex from color input
        onChange({ ...preferences, gridColor: color });
    };

    const commitWallThickness = (rawValue?: string) => {
        const normalized = (rawValue ?? wallThicknessInputValue).trim();
        if (!normalized) {
            setWallThicknessDraft(null);
            return;
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setWallThicknessDraft(null);
            return;
        }

        const baseCm = Math.min(60, Math.max(1, toBaseCm(parsed, activeUnit)));
        onChange({ ...preferences, wallThicknessCm: baseCm });
        setWallThicknessDraft(null);
    };

    const handleWallThicknessKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitWallThickness(event.currentTarget.value);
            event.currentTarget.blur();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            setWallThicknessDraft(null);
            event.currentTarget.blur();
        }
    };

    const handleUnitChange = (newUnit: Preferences['unit']) => {
        const spacingInCm = toBaseCm(preferences.gridSpacing, activeUnit);
        const convertedSpacing = Number(fromBaseCm(spacingInCm, newUnit || 'cm').toFixed(3));
        onChange({ ...preferences, unit: newUnit, gridSpacing: Math.max(0.1, convertedSpacing) });
        setWallThicknessDraft(null);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold theme-text-heading">Preferences</h3>
            <div className="ui-field">
                <label className="ui-label">Grid Spacing ({activeUnit})</label>
                <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={gridSpacingInputValue}
                    onChange={(event) => {
                        const rawValue = event.target.value;
                        setGridSpacingDraft(rawValue);

                        const normalized = rawValue.trim();
                        if (!normalized) {
                            onGridSpacingPreviewChange?.(null);
                            return;
                        }

                        const parsed = Number(normalized);
                        if (!Number.isFinite(parsed) || parsed <= 0) {
                            onGridSpacingPreviewChange?.(null);
                            return;
                        }

                        onGridSpacingPreviewChange?.(Math.max(0.1, parsed));
                    }}
                    onBlur={(event) => commitGridSpacing(event.target.value)}
                    onKeyDown={handleGridSpacingKeyDown}
                    className="ui-input"
                />
            </div>
            <div className="ui-field">
                <label className="ui-label">Grid Color</label>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={preferences.gridColor ?? "#94a3b8"}
                        onChange={handleGridColorChange}
                        className="h-10 w-14 p-1 border rounded-lg pref-color-input"
                        title="Pick grid line color"
                    />
                    <span className="text-xs theme-text-subtle">{preferences.gridColor ?? "#94a3b8"}</span>
                </div>
            </div>
            <div className="ui-field">
                <label className="ui-label">Wall Thickness ({activeUnit})</label>
                <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={wallThicknessInputValue}
                    onChange={(event) => setWallThicknessDraft(event.target.value)}
                    onBlur={(event) => commitWallThickness(event.target.value)}
                    onKeyDown={handleWallThicknessKeyDown}
                    className="ui-input"
                />
                <p className="text-xs theme-text-subtle">Clamped to 1-60cm.</p>
            </div>
            <div className="ui-field">
                <label className="ui-label">Unit</label>
                <select
                    value={preferences.unit}
                    onChange={e => handleUnitChange(e.target.value as Preferences['unit'])}
                    className="ui-select"
                >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="in">in</option>
                    <option value="ft">ft</option>
                </select>
            </div>
            <div className="ui-field">
                <label className="ui-label">Theme</label>
                <select
                    value={preferences.themeMode}
                    onChange={e => onChange({ ...preferences, themeMode: e.target.value as Preferences['themeMode'] })}
                    className="ui-select"
                >
                    <option value="system">System (match computer)</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>
            <div className="ui-field">
                <label className="inline-flex items-center gap-2 text-sm theme-text-soft">
                    <input
                        type="checkbox"
                        checked={preferences.showDebugTelemetry}
                        onChange={(e) => onChange({ ...preferences, showDebugTelemetry: e.target.checked })}
                    />
                    Show debug performance
                </label>
            </div>
            {(onSaveWorkspace || onExportWorkspace || onLoadWorkspace) && (
                <div className="pt-3 border-t theme-divider-border space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide theme-text-muted">Workspace</p>
                    {autosaveStatusLabel && (
                        <p className="text-xs theme-text-subtle">{autosaveStatusLabel}</p>
                    )}
                    {onSaveWorkspace && (
                        <button
                            className="ui-btn ui-btn-secondary w-full"
                            onClick={onSaveWorkspace}
                        >
                            Save Workspace
                        </button>
                    )}
                    {onExportWorkspace && (
                        <button
                            className="ui-btn ui-btn-secondary w-full"
                            onClick={onExportWorkspace}
                        >
                            Export Workspace
                        </button>
                    )}
                    {onLoadWorkspace && (
                        <button
                            className="ui-btn ui-btn-secondary w-full"
                            onClick={onLoadWorkspace}
                        >
                            Load Workspace
                        </button>
                    )}
                </div>
            )}
            {onResetSetup && (
                <div className="pt-3 border-t theme-divider-border space-y-2">
                    <button
                        className="ui-btn ui-btn-secondary w-full"
                        onClick={onResetSetup}
                    >
                        Reset Workspace
                    </button>
                </div>
            )}
        </div>
    );
}
