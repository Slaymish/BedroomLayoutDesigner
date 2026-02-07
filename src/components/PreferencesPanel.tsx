import type { Preferences } from "../types";

interface PreferencesPanelProps {
    onChange: (prefs: Preferences) => void;
    preferences: Preferences;
    onResetSetup?: () => void;
}

export default function PreferencesPanel({ onChange, preferences, onResetSetup }: PreferencesPanelProps) {
    const handleGridSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSize = Math.max(2, parseInt(e.target.value, 10) || 2);
        onChange({ ...preferences, gridSize: newSize });
    };

    const handleGridColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value; // hex from color input
        onChange({ ...preferences, gridColor: color });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Preferences</h3>
            <p className="text-xs text-slate-600">
                Tune the drafting grid and measurement unit for your planning workflow.
            </p>
            <div className="ui-field">
                <label className="ui-label">Grid Size (px)</label>
                <input
                    type="number"
                    min={2}
                    step={1}
                    value={preferences.gridSize}
                    onChange={handleGridSizeChange}
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
                    onChange={e => onChange({ ...preferences, unit: e.target.value as Preferences['unit'] })}
                    className="ui-select"
                >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="in">in</option>
                    <option value="ft">ft</option>
                </select>
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
