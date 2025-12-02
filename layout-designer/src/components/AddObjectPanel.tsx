import type { Preferences } from "../types";
import { toBaseCm } from "../utils/units";

interface AddObjectPanelProps {
    onAddObject: (widthCm: number, heightCm: number, type: string) => void;
    unit?: Preferences['unit'];
}

export default function AddObjectPanel({ onAddObject, unit }: AddObjectPanelProps) {
    return (
        <div className="p-4 border border-gray-200 bg-white rounded-xl shadow-sm space-y-3">
            <h3 className="text-xl font-semibold">Add Objects</h3>
            <button 
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                onClick={() => onAddObject(toBaseCm(100, unit || 'cm'), toBaseCm(200, unit || 'cm'), 'Bed')}
            >
                Add Bed
            </button>
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