import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { RoomItem } from "../types";
import type { Preferences } from "../types";
import { fromBaseCm, toBaseCm } from "../utils/units";

type EditableNumericField = "width" | "height" | "x" | "y" | "rotate";

const formatDraftNumber = (value: number): string => {
    if (!Number.isFinite(value)) return "";
    return Number(value.toFixed(3)).toString();
};

const toDisplayValue = (item: RoomItem, field: EditableNumericField, unit: Preferences["unit"]): number => {
    if (field === "rotate") {
        return Number(item.rotate ?? 0);
    }
    return fromBaseCm(Number(item[field] ?? 0), unit || "cm");
};

const createDraftValues = (item: RoomItem, unit: Preferences["unit"]) => ({
    width: formatDraftNumber(toDisplayValue(item, "width", unit)),
    height: formatDraftNumber(toDisplayValue(item, "height", unit)),
    x: formatDraftNumber(toDisplayValue(item, "x", unit)),
    y: formatDraftNumber(toDisplayValue(item, "y", unit)),
    rotate: formatDraftNumber(toDisplayValue(item, "rotate", unit)),
});

export default function EditObjectPanel({item, onChange, onRemove, unit}: {item: RoomItem; onChange: (updatedItem: RoomItem) => void; onRemove: () => void; unit: Preferences['unit']}) {
    const u = unit || 'cm';
    const [draftValues, setDraftValues] = useState(() => createDraftValues(item, u));

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

    useEffect(() => {
        setDraftValues(createDraftValues(item, u));
    }, [item, u]);

    const resetFieldDraft = (field: EditableNumericField) => {
        setDraftValues(prev => ({ ...prev, [field]: formatDraftNumber(toDisplayValue(item, field, u)) }));
    };

    const commitField = (field: EditableNumericField, rawValue?: string) => {
        const value = (rawValue ?? draftValues[field]).trim();
        if (!value) {
            resetFieldDraft(field);
            return;
        }

        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            resetFieldDraft(field);
            return;
        }

        if (field === "rotate") {
            handleChangeBase("rotate", parsed);
        } else {
            handleChangeBase(field, toBaseCm(parsed, u));
        }
        setDraftValues(prev => ({ ...prev, [field]: formatDraftNumber(parsed) }));
    };

    const handleFieldKeyDown = (field: EditableNumericField, event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commitField(field, event.currentTarget.value);
            event.currentTarget.blur();
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            resetFieldDraft(field);
            event.currentTarget.blur();
        }
    };

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
                setDraftValues(prev => ({ ...prev, rotate: formatDraftNumber(newDisplayVal) }));
            } else {
                newDisplayVal = Math.max(0, newDisplayVal);
                const baseNew = toBaseCm(newDisplayVal, u);
                handleChangeBase(dragRef.current.field, baseNew);
                setDraftValues(prev => ({ ...prev, [dragRef.current.field as EditableNumericField]: formatDraftNumber(newDisplayVal) }));
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
            className="panel-shell w-full min-w-0 p-3 sm:p-3.5 space-y-3"
        >
            <p className="text-xs text-slate-600">Hold Alt and drag on a number field to scrub values.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="ui-field">
                    <label className="ui-label">Width ({u})</label>
                    <input
                        className="ui-input"
                        type="number"
                        value={draftValues.width}
                        onChange={(e) => setDraftValues(prev => ({ ...prev, width: e.target.value }))}
                        onBlur={() => commitField("width")}
                        onKeyDown={(e) => handleFieldKeyDown("width", e)}
                        onMouseDown={(e) => startDrag("width", e)}
                    />
                </div>
                <div className="ui-field">
                    <label className="ui-label">Length ({u})</label>
                    <input
                        className="ui-input"
                        type="number"
                        value={draftValues.height}
                        onChange={(e) => setDraftValues(prev => ({ ...prev, height: e.target.value }))}
                        onBlur={() => commitField("height")}
                        onKeyDown={(e) => handleFieldKeyDown("height", e)}
                        onMouseDown={(e) => startDrag("height", e)}
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="ui-field">
                    <label className="ui-label">X ({u})</label>
                    <input
                        className="ui-input"
                        type="number"
                        value={draftValues.x}
                        onChange={(e) => setDraftValues(prev => ({ ...prev, x: e.target.value }))}
                        onBlur={() => commitField("x")}
                        onKeyDown={(e) => handleFieldKeyDown("x", e)}
                        onMouseDown={(e) => startDrag("x", e)}
                    />
                </div>
                <div className="ui-field">
                    <label className="ui-label">Y ({u})</label>
                    <input
                        className="ui-input"
                        type="number"
                        value={draftValues.y}
                        onChange={(e) => setDraftValues(prev => ({ ...prev, y: e.target.value }))}
                        onBlur={() => commitField("y")}
                        onKeyDown={(e) => handleFieldKeyDown("y", e)}
                        onMouseDown={(e) => startDrag("y", e)}
                    />
                </div>
            </div>
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
                    value={draftValues.rotate}
                    onChange={(e) => setDraftValues(prev => ({ ...prev, rotate: e.target.value }))}
                    onBlur={() => commitField("rotate")}
                    onKeyDown={(e) => handleFieldKeyDown("rotate", e)}
                    onMouseDown={(e) => startDrag("rotate", e)}
                />
            </div>
            <div className="flex flex-wrap gap-3">
                <button className="ui-btn ui-btn-ghost" onClick={() => handleChangeBase('rotate', ((item.rotate || 0) + 90) % 360)}>Rotate 90°</button>
                <button className="ui-btn ui-btn-secondary" onClick={onRemove}>Remove</button>
            </div>
        </div>
    );
}
