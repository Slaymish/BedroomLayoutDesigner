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
        <div className="p-4 border border-slate-200 bg-white rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xl font-semibold text-slate-900">Preferences</h3>
            <div className="flex items-center gap-3">
                <label className="text-sm text-slate-700 w-28">Grid Size (px)</label>
                <input
                    type="number"
                    min={2}
                    step={1}
                    value={preferences.gridSize}
                    onChange={handleGridSizeChange}
                    className="border border-slate-300 rounded-lg px-3 py-2 w-28"
                />
            </div>
            <div className="flex items-center gap-3">
                <label className="text-sm text-slate-700 w-28">Grid Color</label>
                <input
                    type="color"
                    value={preferences.gridColor ?? "#94a3b8"}
                    onChange={handleGridColorChange}
                    className="h-9 w-12 p-0 border border-slate-300 rounded-lg"
                    title="Pick grid line color"
                />
            </div>
            <div className="flex items-center gap-3">
                <label className="text-sm text-slate-700 w-28">Unit</label>
                <select
                    value={preferences.unit}
                    onChange={e => onChange({ ...preferences, unit: e.target.value as Preferences['unit'] })}
                    className="border border-slate-300 rounded-lg px-3 py-2 w-28 bg-white"
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
                    <p className="text-sm text-slate-700">Need to start room setup again?</p>
                    <button
                        className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700"
                        onClick={onResetSetup}
                    >
                        Reset Setup
                    </button>
                </div>
            )}
        </div>
    );
}
