import type { RoomItem } from "../types";

export default function EditObjectPanel({item, onChange, onRemove}: {item: RoomItem; onClose: () => void; onChange: (updatedItem: RoomItem) => void; onRemove: () => void}) {
    
    const handleChange = (field: keyof RoomItem, value: number) => {
        const updatedItem = { ...item, [field]: value };
        onChange(updatedItem);
    };

    return (
        <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-300 p-3 rounded shadow-sm space-y-3"
        >
            <h3 className="text-lg font-semibold">Edit Object</h3>
            <div className="flex flex-col gap-1">
                <label className="text-sm">Width:</label>
                <input 
                    className="border rounded px-2 py-1"
                    type="number" 
                    value={item.width} 
                    onChange={(e) => handleChange('width', Number(e.target.value))}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm">Height:</label>
                <input 
                    className="border rounded px-2 py-1"
                    type="number" 
                    value={item.height} 
                    onChange={(e) => handleChange('height', Number(e.target.value))}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm">X Position:</label>
                <input 
                    className="border rounded px-2 py-1"
                    type="number" 
                    value={item.x} 
                    onChange={(e) => handleChange('x', Number(e.target.value))}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm">Y Position:</label>
                <input 
                    className="border rounded px-2 py-1"
                    type="number" 
                    value={item.y} 
                    onChange={(e) => handleChange('y', Number(e.target.value))}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm">Rotation:</label>
                <input 
                    className="border rounded px-2 py-1"
                    type="number" 
                    value={item.rotate || 0} 
                    onChange={(e) => handleChange('rotate', Number(e.target.value))}
                />
            </div>
            <div className="flex gap-2">
                <button className="rounded border px-3 py-1 bg-gray-100 hover:bg-gray-200" onClick={() => handleChange('rotate', ((item.rotate || 0) + 90) % 360)}>Rotate 90°</button>
                <button className="rounded border px-3 py-1 bg-red-600 text-white hover:bg-red-700" onClick={onRemove}>Remove</button>
            </div>
        </div>
    );
}