import { useRef } from "react";
import type { RoomItem } from "../types";
import type { Preferences } from "../types";
import { fromBaseCm, toBaseCm } from "../utils/units";

export default function EditObjectPanel({item, onChange, onRemove, unit}: {item: RoomItem; onClose: () => void; onChange: (updatedItem: RoomItem) => void; onRemove: () => void; unit: Preferences['unit']}) {
    const u = unit || 'cm';

    const handleChangeBase = (field: keyof RoomItem, baseValue: number) => {
        const updatedItem = { ...item, [field]: baseValue };
        onChange(updatedItem);
    };

    const dragRef = useRef<{ field: 'width'|'height'|'x'|'y'|'rotate' | null; startX: number; startDisplayVal: number; dragging: boolean }>({
        field: null,
        startX: 0,
        startDisplayVal: 0,
        dragging: false,
    });

    const startDrag = (field: 'width'|'height'|'x'|'y'|'rotate', e: React.MouseEvent<HTMLInputElement>) => {
        e.preventDefault();
        const baseVal = Number((item as any)[field]) || 0;
        const displayVal = field === 'rotate' ? baseVal : fromBaseCm(baseVal, u);
        dragRef.current = { field, startX: e.clientX, startDisplayVal: displayVal, dragging: true };

        const onMove = (ev: MouseEvent) => {
            if (!dragRef.current.dragging || dragRef.current.field === null) return;
            const deltaX = ev.clientX - dragRef.current.startX;
            let step = 1;
            if (ev.shiftKey) step = 5;
            if (ev.altKey || ev.ctrlKey || ev.metaKey) step = 0.2;
            let newDisplayVal = dragRef.current.startDisplayVal + deltaX * step;

            if (dragRef.current.field === 'rotate') {
                newDisplayVal = ((Math.round(newDisplayVal) % 360) + 360) % 360;
                handleChangeBase('rotate', newDisplayVal);
            } else {
                newDisplayVal = Math.max(0, newDisplayVal);
                const baseNew = toBaseCm(newDisplayVal, u);
                handleChangeBase(dragRef.current.field, baseNew);
            }
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
            {(() => {
                const displayWidth = fromBaseCm(item.width, u);
                const displayHeight = fromBaseCm(item.height, u);
                const displayX = fromBaseCm(item.x, u);
                const displayY = fromBaseCm(item.y, u);
                return (
                    <>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">Width ({u}):</label>
                            <input
                                className="border rounded px-2 py-1 cursor-ew-resize select-none"
                                type="number"
                                value={displayWidth}
                                onChange={(e) => handleChangeBase('width', toBaseCm(Number(e.target.value), u))}
                                onMouseDown={(e) => startDrag('width', e)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">Height ({u}):</label>
                            <input
                                className="border rounded px-2 py-1 cursor-ew-resize select-none"
                                type="number"
                                value={displayHeight}
                                onChange={(e) => handleChangeBase('height', toBaseCm(Number(e.target.value), u))}
                                onMouseDown={(e) => startDrag('height', e)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">X Position ({u}):</label>
                            <input
                                className="border rounded px-2 py-1 cursor-ew-resize select-none"
                                type="number"
                                value={displayX}
                                onChange={(e) => handleChangeBase('x', toBaseCm(Number(e.target.value), u))}
                                onMouseDown={(e) => startDrag('x', e)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm">Y Position ({u}):</label>
                            <input
                                className="border rounded px-2 py-1 cursor-ew-resize select-none"
                                type="number"
                                value={displayY}
                                onChange={(e) => handleChangeBase('y', toBaseCm(Number(e.target.value), u))}
                                onMouseDown={(e) => startDrag('y', e)}
                            />
                        </div>
                    </>
                );
            })()}
            {item.type === 'Door' && (
                <div className="space-y-2 border-t border-gray-200 pt-2">
                    <h4 className="text-sm font-semibold">Door Settings</h4>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm">Open Direction</label>
                        <select 
                            className="border rounded px-2 py-1"
                            value={item.doorOpenDirection || 'in'}
                            onChange={(e) => {
                                const updatedItem = { ...item, doorOpenDirection: e.target.value as 'in' | 'out' };
                                onChange(updatedItem);
                            }}
                        >
                            <option value="in">In</option>
                            <option value="out">Out</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm">Hinge Side</label>
                        <select 
                            className="border rounded px-2 py-1"
                            value={item.doorOpenSide || 'left'}
                            onChange={(e) => {
                                const updatedItem = { ...item, doorOpenSide: e.target.value as 'left' | 'right' };
                                onChange(updatedItem);
                            }}
                        >
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-1">
                <label className="text-sm">Rotation:</label>
                <input
                    className="border rounded px-2 py-1 cursor-ew-resize select-none"
                    type="number"
                    value={item.rotate || 0}
                    onChange={(e) => handleChangeBase('rotate', Number(e.target.value))}
                    onMouseDown={(e) => startDrag('rotate', e)}
                />
            </div>
            <div className="flex gap-3">
                <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 hover:bg-gray-50" onClick={() => handleChangeBase('rotate', ((item.rotate || 0) + 90) % 360)}>Rotate 90°</button>
                <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700" onClick={onRemove}>Remove</button>
            </div>
        </div>
    );
}