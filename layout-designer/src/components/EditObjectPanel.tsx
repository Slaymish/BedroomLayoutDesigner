import type { RoomItem } from "../types";


export default function EditObjectPanel({item, onClose, onChange}: {item: RoomItem; onClose: () => void; onChange: (updatedItem: RoomItem) => void}) {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const updatedItem: RoomItem = {
            ...item,
            width: Number(formData.get('width')),
            height: Number(formData.get('height')),
            x: Number(formData.get('x')),
            y: Number(formData.get('y')),
        };
        onChange(updatedItem);
        onClose();
    }
    return (
        <div style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'white', border: '1px solid #ccc', padding: '10px', zIndex: 1000 }}>
            <h3>Edit Object</h3>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>
                        Width:
                        <input type="number" name="width" defaultValue={item.width} required />
                    </label>
                </div>
                <div>
                    <label>
                        Height:
                        <input type="number" name="height" defaultValue={item.height} required />
                    </label>
                </div>
                <div>
                    <label>
                        X Position:
                        <input type="number" name="x" defaultValue={item.x} required />
                    </label>
                </div>
                <div>
                    <label>
                        Y Position:
                        <input type="number" name="y" defaultValue={item.y} required />
                    </label>
                </div>
                <button type="submit" style={{ marginTop: '10px' }}>Save</button>
                <button type="button" onClick={onClose} style={{ marginTop: '10px', marginLeft: '10px' }}>Cancel</button>
            </form>
        </div>
    );
}