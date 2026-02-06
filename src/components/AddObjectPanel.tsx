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
        <div className="p-4 border border-slate-200 bg-white rounded-2xl shadow-sm space-y-5">
            <div className="space-y-1">
                <h3 className="text-xl font-semibold text-slate-900">Add Furniture</h3>
                <p className="text-xs text-slate-500">Use presets for speed, then tweak details in the edit panel.</p>
            </div>
            <div className="space-y-2">
                <div className="flex gap-2">
                    <select 
                        aria-label="Bed size preset"
                        className="block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                        className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 whitespace-nowrap transition-colors"
                        onClick={addBed}
                    >
                        Add Bed
                    </button>
                </div>
                <p className="text-xs text-slate-500">
                    {selectedBedSize.width} x {selectedBedSize.height} cm
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FURNITURE_PRESETS.map((preset) => (
                    <button
                        key={preset.type}
                        className="inline-flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium border border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors"
                        onClick={() => onAddObject(toBaseCm(preset.widthCm, 'cm'), toBaseCm(preset.heightCm, 'cm'), preset.type)}
                    >
                        <span>{preset.type}</span>
                        <span className="text-xs text-slate-500">{preset.widthCm}x{preset.heightCm}cm</span>
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
                <h4 className="text-base font-semibold text-slate-900">Custom Object</h4>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-700">Type</label>
                    <input className="border border-slate-300 rounded-lg px-3 py-2" type="text" name="type" required />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-700">Width ({activeUnit})</label>
                    <input className="border border-slate-300 rounded-lg px-3 py-2" type="number" name="width" min={0.1} step={0.1} required />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-700">Height ({activeUnit})</label>
                    <input className="border border-slate-300 rounded-lg px-3 py-2" type="number" name="height" min={0.1} step={0.1} required />
                </div>
                <button type="submit" className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors">Add Custom Object</button>
            </form>
        </div>
    );
}
