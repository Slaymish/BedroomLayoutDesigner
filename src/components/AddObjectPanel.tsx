import { useState } from 'react';
import type { Preferences } from "../types";
import { toBaseCm } from "../utils/units";

const BED_SIZES = [
    { name: 'Single (90x190cm)', width: 90, height: 190 },
    { name: 'Double (135x190cm)', width: 135, height: 190 },
    { name: 'Queen (150x190cm)', width: 150, height: 190 },
    { name: 'King (150x200cm)', width: 150, height: 200 },
    { name: 'Super King (180x200cm)', width: 180, height: 200 },
];

interface AddObjectPanelProps {
    onAddObject: (widthCm: number, heightCm: number, type: string) => void;
    unit?: Preferences['unit'];
}

export default function AddObjectPanel({ onAddObject, unit }: AddObjectPanelProps) {
    const [selectedBedSize, setSelectedBedSize] = useState(BED_SIZES[0]);

    return (
        <div className="p-4 border border-gray-200 bg-white rounded-xl shadow-sm space-y-3">
            <h3 className="text-xl font-semibold">Add Objects</h3>
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Bed Size</label>
                <div className="flex gap-2">
                    <select 
                        className="block w-full rounded-md border-0 py-1.5 px-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
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
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50 whitespace-nowrap"
                        onClick={() => onAddObject(toBaseCm(selectedBedSize.width, 'cm'), toBaseCm(selectedBedSize.height, 'cm'), 'Bed')}
                    >
                        Add
                    </button>
                </div>
            </div>
            <button 
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                onClick={() => onAddObject(toBaseCm(150, unit || 'cm'), toBaseCm(60, unit || 'cm'), 'Wardrobe')}
            >
                Add Wardrobe
            </button>
            <button 
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                onClick={() => onAddObject(toBaseCm(120, unit || 'cm'), toBaseCm(60, unit || 'cm'), 'Desk')}
            >
                Add Desk
            </button>
            <button 
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                onClick={() => onAddObject(toBaseCm(80, unit || 'cm'), toBaseCm(10, unit || 'cm'), 'Door')}
            >
                Add Door
            </button>
            <button 
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                onClick={() => onAddObject(toBaseCm(100, unit || 'cm'), toBaseCm(10, unit || 'cm'), 'Window')}
            >
                Add Window
            </button>
            <form className="pt-2 mt-2 border-t border-gray-200 space-y-3" onSubmit={e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const widthRaw = parseFloat((form.elements.namedItem('width') as HTMLInputElement).value);
                const heightRaw = parseFloat((form.elements.namedItem('height') as HTMLInputElement).value);
                const type = (form.elements.namedItem('type') as HTMLInputElement).value;
                const u = unit || 'cm';
                onAddObject(toBaseCm(widthRaw, u), toBaseCm(heightRaw, u), type);
                form.reset();
            }}>
                <h4 className="text-base font-semibold">Custom Object</h4>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-700">Type</label>
                    <input className="border border-gray-300 rounded-md px-2 py-1" type="text" name="type" required />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-700">Width ({unit})</label>
                    <input className="border border-gray-300 rounded-md px-2 py-1" type="number" name="width" required />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-700">Height ({unit})</label>
                    <input className="border border-gray-300 rounded-md px-2 py-1" type="number" name="height" required />
                </div>
                <button type="submit" className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">Add Custom Object</button>
            </form>
        </div>
    );
}