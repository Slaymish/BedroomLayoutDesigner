import { useState } from 'react';
import type { Preferences } from "../types";
import { toBaseCm } from "../utils/units";

const BED_SIZES = [
    { name: 'Single (90x190cm)', width: 90, height: 190 },
    { name: 'King Single (107x203cm)', width: 107, height: 203 },
    { name: 'Double (135x190cm)', width: 135, height: 190 },
    { name: 'Queen (150x190cm)', width: 150, height: 190 },
    { name: 'King (150x200cm)', width: 150, height: 200 },
    { name: 'Super King (180x200cm)', width: 180, height: 200 },
];

const FURNITURE_PRESETS = [
    { type: 'Wardrobe', widthCm: 150, heightCm: 60 },
    { type: 'Desk', widthCm: 120, heightCm: 60 },
    { type: 'Door', widthCm: 80, heightCm: 10 },
    { type: 'Window', widthCm: 100, heightCm: 10 },
];

interface AddObjectPanelProps {
    onAddObject: (widthCm: number, heightCm: number, type: string) => void;
    unit?: Preferences['unit'];
}

export default function AddObjectPanel({ onAddObject, unit }: AddObjectPanelProps) {
    const [selectedBedSize, setSelectedBedSize] = useState(BED_SIZES[0]);
    const activeUnit = unit || 'cm';

    const addBed = () => {
        onAddObject(
            toBaseCm(selectedBedSize.width, 'cm'),
            toBaseCm(selectedBedSize.height, 'cm'),
            'Bed'
        );
    };

    return (
        <div className="surface-card panel-shell p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-900">Add Objects</h3>
                <span className="text-xs font-medium text-slate-500">Preset + custom</span>
            </div>
            <div className="space-y-2">
                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                    <select
                        aria-label="Bed size preset"
                        className="ui-select"
                        value={selectedBedSize.name}
                        onChange={(e) => {
                            const size = BED_SIZES.find(s => s.name === e.target.value);
                            if (size) setSelectedBedSize(size);
                        }}
                    >
                        {BED_SIZES.map((size) => (
                            <option key={size.name} value={size.name}>{size.name}</option>
                        ))}
                    </select>
                    <button
                        className="ui-btn ui-btn-primary"
                        onClick={addBed}
                    >
                        Add Bed
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FURNITURE_PRESETS.map((preset) => (
                    <button
                        key={preset.type}
                        className="ui-btn ui-btn-ghost w-full justify-between px-3 overflow-hidden"
                        onClick={() => onAddObject(toBaseCm(preset.widthCm, 'cm'), toBaseCm(preset.heightCm, 'cm'), preset.type)}
                    >
                        <span className="min-w-0 truncate text-left">{preset.type}</span>
                        <span className="shrink-0 text-[11px] text-slate-500 whitespace-nowrap">{preset.widthCm}x{preset.heightCm}cm</span>
                    </button>
                ))}
            </div>
            <form className="pt-4 border-t border-slate-200 space-y-3" onSubmit={e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const widthRaw = parseFloat((form.elements.namedItem('width') as HTMLInputElement).value);
                const heightRaw = parseFloat((form.elements.namedItem('height') as HTMLInputElement).value);
                const type = (form.elements.namedItem('type') as HTMLInputElement).value;
                if (!type.trim() || widthRaw <= 0 || heightRaw <= 0 || Number.isNaN(widthRaw) || Number.isNaN(heightRaw)) {
                    return;
                }
                onAddObject(toBaseCm(widthRaw, activeUnit), toBaseCm(heightRaw, activeUnit), type.trim());
                form.reset();
            }}>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Custom Object</h4>
                <div className="ui-field">
                    <label className="ui-label">Type</label>
                    <input className="ui-input" type="text" name="type" required />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="ui-field">
                        <label className="ui-label">Width ({activeUnit})</label>
                        <input className="ui-input" type="number" name="width" min={0.1} step={0.1} required />
                    </div>
                    <div className="ui-field">
                        <label className="ui-label">Height ({activeUnit})</label>
                        <input className="ui-input" type="number" name="height" min={0.1} step={0.1} required />
                    </div>
                </div>
                <button type="submit" className="ui-btn ui-btn-secondary w-full sm:w-auto">Add Custom</button>
            </form>
        </div>
    );
}
