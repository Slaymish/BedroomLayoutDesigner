import type { RoomItem } from "../types";

export default function EditObjectPanel({item, onChange}: {item: RoomItem; onClose: () => void; onChange: (updatedItem: RoomItem) => void}) {
    
    const handleChange = (field: keyof RoomItem, value: number) => {
        const updatedItem = { ...item, [field]: value };
        onChange(updatedItem);
    };

    return (
        <div 
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'white', border: '1px solid #ccc', padding: '10px', zIndex: 1000 }}
        >
            <h3>Edit Object</h3>
            <div>
                <label>
                    Width:
                    <input 
                        type="number" 
                        value={item.width} 
                        onChange={(e) => handleChange('width', Number(e.target.value))}
                    />
                </label>
            </div>
            <div>
                <label>
                    Height:
                    <input 
                        type="number" 
                        value={item.height} 
                        onChange={(e) => handleChange('height', Number(e.target.value))}
                    />
                </label>
            </div>
            <div>
                <label>
                    X Position:
                    <input 
                        type="number" 
                        value={item.x} 
                        onChange={(e) => handleChange('x', Number(e.target.value))}
                    />
                </label>
            </div>
            <div>
                <label>
                    Y Position:
                    <input 
                        type="number" 
                        value={item.y} 
                        onChange={(e) => handleChange('y', Number(e.target.value))}
                    />
                </label>
            </div>
            <div>
                <label>
                    Rotation:
                    <input 
                        type="number" 
                        value={item.rotate || 0} 
                        onChange={(e) => handleChange('rotate', Number(e.target.value))}
                    />
                </label>
            </div>
            <div>
                <button onClick={(e) => handleChange('rotate', ((item.rotate || 0) + 90) % 360)}>Rotate 90°</button>
            </div>
        </div>
    );
}