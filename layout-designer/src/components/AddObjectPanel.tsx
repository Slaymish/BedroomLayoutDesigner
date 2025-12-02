interface AddObjectPanelProps {
    onAddObject: (width: number, height: number, type: string) => void;
}

export default function AddObjectPanel({ onAddObject }: AddObjectPanelProps) {
    return (
        <div className="p-3 border-r border-gray-300">
            <h3 className="text-lg font-semibold mb-3">Add Objects</h3>
            <button 
                className="block mb-2 rounded border px-4 py-2 bg-gray-100 hover:bg-gray-200"
                onClick={() => onAddObject(100, 200, 'Bed')}
            >
                Add Bed
            </button>
            <button 
                className="block mb-2 rounded border px-4 py-2 bg-gray-100 hover:bg-gray-200"
                onClick={() => onAddObject(150, 60, 'Wardrobe')}
            >
                Add Wardrobe
            </button>
            <button 
                className="block mb-2 rounded border px-4 py-2 bg-gray-100 hover:bg-gray-200"
                onClick={() => onAddObject(120, 60, 'Desk')}
            >
                Add Desk
            </button>
            <form className="mt-5 space-y-2" onSubmit={e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const width = parseInt((form.elements.namedItem('width') as HTMLInputElement).value, 10);
                const height = parseInt((form.elements.namedItem('height') as HTMLInputElement).value, 10);
                const type = (form.elements.namedItem('type') as HTMLInputElement).value;
                onAddObject(width, height, type);
                form.reset();
            }}>
                <h4 className="text-base font-medium">Custom Object</h4>
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Type:</label>
                    <input className="border rounded px-2 py-1" type="text" name="type" required />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Width:</label>
                    <input className="border rounded px-2 py-1" type="number" name="width" required />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm">Height:</label>
                    <input className="border rounded px-2 py-1" type="number" name="height" required />
                </div>
                <button type="submit" className="mt-2 rounded border px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">Add Custom Object</button>
            </form>
        </div>
    );
}