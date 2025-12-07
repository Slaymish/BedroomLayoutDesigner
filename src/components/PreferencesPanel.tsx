import type { Preferences } from "../types";

export default function PreferencesPanel({ onChange, preferences }: { onChange: (prefs: Preferences) => void; preferences: Preferences }) {
    const handleGridSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSize = parseInt(e.target.value, 10) || 0;
        onChange({ ...preferences, gridSize: newSize });
    };

    const handleGridColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value; // hex from color input
        onChange({ ...preferences, gridColor: color });
    };

    return (
        <div className="p-4 border border-gray-200 bg-white rounded-xl shadow-sm space-y-4">
            <h3 className="text-xl font-semibold">Preferences</h3>
            <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 w-28">Grid Size (px)</label>
                <input
                    type="number"
                    min={2}
                    step={1}
                    value={preferences.gridSize}
                    onChange={handleGridSizeChange}
                    className="border border-gray-300 rounded-md px-2 py-1 w-28"
                />
            </div>
            <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 w-28">Grid Color</label>
                <input
                    type="color"
                    value={preferences.gridColor ?? "#94a3b8"}
                    onChange={handleGridColorChange}
                    className="h-9 w-12 p-0 border border-gray-300 rounded-md"
                    title="Pick grid line color"
                />
            </div>
            <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700 w-28">Unit</label>
                <select
                    value={preferences.unit}
                    onChange={e => onChange({ ...preferences, unit: e.target.value as Preferences['unit'] })}
                    className="border border-gray-300 rounded-md px-2 py-1 w-28"
                >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="in">in</option>
                    <option value="ft">ft</option>
                </select>
            </div>
        </div>
    );
}