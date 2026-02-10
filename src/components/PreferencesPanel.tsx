import type { Preferences } from "../types";
import { fromBaseCm, toBaseCm } from "../utils/units";

interface PreferencesPanelProps {
    onChange: (prefs: Preferences) => void;
    preferences: Preferences;
    onResetSetup?: () => void;
}

export default function PreferencesPanel({ onChange, preferences, onResetSetup }: PreferencesPanelProps) {
    const activeUnit = preferences.unit || 'cm';

    const handleGridSpacingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSpacing = Math.max(0.1, parseFloat(e.target.value) || 0.1);
        onChange({ ...preferences, gridSpacing: newSpacing });
    };

    const handleGridColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value; // hex from color input
        onChange({ ...preferences, gridColor: color });
    };

    const handleUnitChange = (newUnit: Preferences['unit']) => {
        const spacingInCm = toBaseCm(preferences.gridSpacing, activeUnit);
        const convertedSpacing = Number(fromBaseCm(spacingInCm, newUnit || 'cm').toFixed(3));
        onChange({ ...preferences, unit: newUnit, gridSpacing: Math.max(0.1, convertedSpacing) });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Preferences</h3>
            <div className="ui-field">
                <label className="ui-label">Grid Spacing ({activeUnit})</label>
                <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={preferences.gridSpacing}
                    onChange={handleGridSpacingChange}
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
                        className="h-10 w-14 p-1 border border-slate-300 rounded-lg bg-white"
                        title="Pick grid line color"
                    />
                    <span className="text-xs text-slate-500">{preferences.gridColor ?? "#94a3b8"}</span>
                </div>
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
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={preferences.showDebugTelemetry}
                        onChange={(e) => onChange({ ...preferences, showDebugTelemetry: e.target.checked })}
                    />
                    Show debug performance
                </label>
            </div>
            {onResetSetup && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
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
