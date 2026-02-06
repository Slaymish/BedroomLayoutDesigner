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
            className="surface-card panel-shell w-full min-w-0 p-4 sm:p-5 space-y-4"
        >
            <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-900">Edit Object</h3>
                <button
                    className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs"
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
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="ui-field">
                                <label className="ui-label">Width ({u})</label>
                                <input
                                    className="ui-input"
                                    type="number"
                                    value={displayWidth}
                                    onChange={(e) => handleChangeBase('width', toBaseCm(Number(e.target.value), u))}
                                    onMouseDown={(e) => startDrag('width', e)}
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label">Height ({u})</label>
                                <input
                                    className="ui-input"
                                    type="number"
                                    value={displayHeight}
                                    onChange={(e) => handleChangeBase('height', toBaseCm(Number(e.target.value), u))}
                                    onMouseDown={(e) => startDrag('height', e)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="ui-field">
                                <label className="ui-label">X ({u})</label>
                                <input
                                    className="ui-input"
                                    type="number"
                                    value={displayX}
                                    onChange={(e) => handleChangeBase('x', toBaseCm(Number(e.target.value), u))}
                                    onMouseDown={(e) => startDrag('x', e)}
                                />
                            </div>
                            <div className="ui-field">
                                <label className="ui-label">Y ({u})</label>
                                <input
                                    className="ui-input"
                                    type="number"
                                    value={displayY}
                                    onChange={(e) => handleChangeBase('y', toBaseCm(Number(e.target.value), u))}
                                    onMouseDown={(e) => startDrag('y', e)}
                                />
                            </div>
                        </div>
                    </>
                );
            })()}
            {item.type === 'Door' && (
                <div className="surface-card-muted p-3 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Door Swing</h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="ui-field">
                            <label className="ui-label">Direction</label>
                            <select 
                                className="ui-select"
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
                        <div className="ui-field">
                            <label className="ui-label">Hinge</label>
                            <select 
                                className="ui-select"
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
                </div>
            )}
            <div className="ui-field">
                <label className="ui-label">Rotation (degrees)</label>
                <input
                    className="ui-input"
                    type="number"
                    value={item.rotate || 0}
                    onChange={(e) => handleChangeBase('rotate', Number(e.target.value))}
                    onMouseDown={(e) => startDrag('rotate', e)}
                />
            </div>
            <div className="flex flex-wrap gap-3">
                <button className="ui-btn ui-btn-ghost" onClick={() => handleChangeBase('rotate', ((item.rotate || 0) + 90) % 360)}>Rotate 90°</button>
                <button className="ui-btn ui-btn-secondary" onClick={onRemove}>Remove</button>
            </div>
        </div>
    );
}
