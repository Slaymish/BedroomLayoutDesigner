import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { RoomItem } from "../types";
import type { Preferences } from "../types";
import { fromBaseCm, toBaseCm } from "../utils/units";

export default function EditObjectPanel({item, onClose, onChange, onRemove, unit}: {item: RoomItem; onClose: () => void; onChange: (updatedItem: RoomItem) => void; onRemove: () => void; unit: Preferences['unit']}) {
    const u = unit || 'cm';
    type EditableNumericField = 'width' | 'height' | 'x' | 'y' | 'rotate';

    const handleChangeBase = (field: keyof RoomItem, baseValue: number) => {
        if (!Number.isFinite(baseValue)) return;
        const updatedItem = { ...item, [field]: baseValue };
        onChange(updatedItem);
    };

    const dragRef = useRef<{ field: EditableNumericField | null; startX: number; startDisplayVal: number; dragging: boolean }>({
        field: null,
        startX: 0,
        startDisplayVal: 0,
        dragging: false,
    });

    const startDrag = (field: EditableNumericField, e: ReactMouseEvent<HTMLInputElement>) => {
        // Alt+drag enables scrubbing while preserving normal click-to-edit behavior.
        if (!e.altKey) return;
        e.preventDefault();
        const baseVal = Number(item[field] ?? 0) || 0;
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
            className="w-full bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-4"
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-xl font-semibold text-slate-900">Edit Object</h3>
                    <p className="text-xs text-slate-500">Tip: hold Alt and drag left/right on a number field to scrub quickly.</p>
                </div>
                <button
                    className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    onClick={onClose}
                    aria-label="Close edit panel"
                >
                    Close
                </button>
            </div>
            {(() => {
                const displayWidth = fromBaseCm(item.width, u);
                const displayHeight = fromBaseCm(item.height, u);
                const displayX = fromBaseCm(item.x, u);
                const displayY = fromBaseCm(item.y, u);
                return (
                    <>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-slate-700">Width ({u})</label>
                            <input
                                className="border border-slate-300 rounded-lg px-3 py-2"
                                type="number"
                                value={displayWidth}
                                onChange={(e) => handleChangeBase('width', toBaseCm(Number(e.target.value), u))}
                                onMouseDown={(e) => startDrag('width', e)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-slate-700">Height ({u})</label>
                            <input
                                className="border border-slate-300 rounded-lg px-3 py-2"
                                type="number"
                                value={displayHeight}
                                onChange={(e) => handleChangeBase('height', toBaseCm(Number(e.target.value), u))}
                                onMouseDown={(e) => startDrag('height', e)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-slate-700">X Position ({u})</label>
                            <input
                                className="border border-slate-300 rounded-lg px-3 py-2"
                                type="number"
                                value={displayX}
                                onChange={(e) => handleChangeBase('x', toBaseCm(Number(e.target.value), u))}
                                onMouseDown={(e) => startDrag('x', e)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm text-slate-700">Y Position ({u})</label>
                            <input
                                className="border border-slate-300 rounded-lg px-3 py-2"
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
                <div className="space-y-2 border-t border-slate-200 pt-2">
                    <h4 className="text-sm font-semibold text-slate-800">Door Settings</h4>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-slate-700">Open Direction</label>
                        <select 
                            className="border border-slate-300 rounded-lg px-3 py-2"
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
                        <label className="text-sm text-slate-700">Hinge Side</label>
                        <select 
                            className="border border-slate-300 rounded-lg px-3 py-2"
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
                <label className="text-sm text-slate-700">Rotation (degrees)</label>
                <input
                    className="border border-slate-300 rounded-lg px-3 py-2"
                    type="number"
                    value={item.rotate || 0}
                    onChange={(e) => handleChangeBase('rotate', Number(e.target.value))}
                    onMouseDown={(e) => startDrag('rotate', e)}
                />
            </div>
            <div className="flex flex-wrap gap-3">
                <button className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100" onClick={() => handleChangeBase('rotate', ((item.rotate || 0) + 90) % 360)}>Rotate 90°</button>
                <button className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700" onClick={onRemove}>Remove</button>
            </div>
        </div>
    );
}
