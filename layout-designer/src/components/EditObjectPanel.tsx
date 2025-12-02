import { useRef } from "react";
import type { RoomItem } from "../types";
import type { Preferences } from "../types";

export default function EditObjectPanel({item, onChange, onRemove, unit}: {item: RoomItem; onClose: () => void; onChange: (updatedItem: RoomItem) => void; onRemove: () => void; unit: Preferences['unit']}) {
    
    const handleChange = (field: keyof RoomItem, value: number) => {
        const updatedItem = { ...item, [field]: value };
        onChange(updatedItem);
    };

    const dragRef = useRef<{ field: 'width'|'height'|'x'|'y'|'rotate' | null; startX: number; startVal: number; dragging: boolean }>({
        field: null,
        startX: 0,
        startVal: 0,
        dragging: false,
    });

    const startDrag = (field: 'width'|'height'|'x'|'y'|'rotate', e: React.MouseEvent<HTMLInputElement>) => {
        e.preventDefault();
        const currentVal = Number((item as any)[field]) || 0;
        dragRef.current = { field, startX: e.clientX, startVal: currentVal, dragging: true };

        const onMove = (ev: MouseEvent) => {
            if (!dragRef.current.dragging || dragRef.current.field === null) return;
            const deltaX = ev.clientX - dragRef.current.startX;
            // Base sensitivity: 1 unit per pixel; modifiers for fine/fast
            let step = 1;
            if (ev.shiftKey) step = 5;       // faster
            if (ev.altKey || ev.ctrlKey || ev.metaKey) step = 0.2; // finer
            let newVal = dragRef.current.startVal + deltaX * step;

            // Round to integer (keeps UX simple); rotation wraps 0..359
            if (dragRef.current.field === 'rotate') {
                newVal = ((Math.round(newVal) % 360) + 360) % 360;
            } else {
                newVal = Math.round(newVal);
                // Basic clamps to non-negative for sizes/positions
                if (dragRef.current.field === 'width' || dragRef.current.field === 'height') {
                    newVal = Math.max(1, newVal);
                } else if (dragRef.current.field === 'x' || dragRef.current.field === 'y') {
                    newVal = Math.max(0, newVal);
                }
            }

            handleChange(dragRef.current.field, newVal);
        };

        const onUp = () => {
            dragRef.current.dragging = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm space-y-4"
        >
            <h3 className="text-xl font-semibold">Edit Object</h3>
            <div className="flex flex-col gap-1">
                <label className="text-sm">Width ({unit}):</label>
                <input 
                    className="border rounded px-2 py-1 cursor-ew-resize select-none"
                    type="number" 
                    value={item.width} 
                    onChange={(e) => handleChange('width', Number(e.target.value))}
                    onMouseDown={(e) => startDrag('width', e)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm">Height ({unit}):</label>
                <input 
                    className="border rounded px-2 py-1 cursor-ew-resize select-none"
                    type="number" 
                    value={item.height} 
                    onChange={(e) => handleChange('height', Number(e.target.value))}
                    onMouseDown={(e) => startDrag('height', e)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm">X Position:</label>
                <input 
                    className="border rounded px-2 py-1 cursor-ew-resize select-none"
                    type="number" 
                    value={item.x} 
                    onChange={(e) => handleChange('x', Number(e.target.value))}
                    onMouseDown={(e) => startDrag('x', e)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm">Y Position:</label>
                <input 
                    className="border rounded px-2 py-1 cursor-ew-resize select-none"
                    type="number" 
                    value={item.y} 
                    onChange={(e) => handleChange('y', Number(e.target.value))}
                    onMouseDown={(e) => startDrag('y', e)}
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm">Rotation:</label>
                <input 
                    className="border rounded px-2 py-1 cursor-ew-resize select-none"
                    type="number" 
                    value={item.rotate || 0} 
                    onChange={(e) => handleChange('rotate', Number(e.target.value))}
                    onMouseDown={(e) => startDrag('rotate', e)}
                />
            </div>
            <div className="flex gap-3">
                <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50" onClick={() => handleChange('rotate', ((item.rotate || 0) + 90) % 360)}>Rotate 90°</button>
                <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700" onClick={onRemove}>Remove</button>
            </div>
        </div>
    );
}