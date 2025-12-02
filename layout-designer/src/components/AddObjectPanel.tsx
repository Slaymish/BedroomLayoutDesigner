interface AddObjectPanelProps {
    onAddObject: (width: number, height: number, type: string) => void;
}

export default function AddObjectPanel({ onAddObject }: AddObjectPanelProps) {
    return (
        <div style={{ padding: '10px', borderRight: '1px solid #ccc' }}>
            <h3>Add Objects</h3>
            <button 
                style={{ display: 'block', marginBottom: '10px' }} 
                onClick={() => onAddObject(100, 200, 'Bed')}
            >
                Add Bed
            </button>
            <button 
                style={{ display: 'block', marginBottom: '10px' }} 
                onClick={() => onAddObject(150, 60, 'Wardrobe')}
            >
                Add Wardrobe
            </button>
            <button 
                style={{ display: 'block', marginBottom: '10px' }} 
                onClick={() => onAddObject(120, 60, 'Desk')}
            >
                Add Desk
            </button>
            <form style={{ marginTop: '20px' }} onSubmit={e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const width = parseInt((form.elements.namedItem('width') as HTMLInputElement).value, 10);
                const height = parseInt((form.elements.namedItem('height') as HTMLInputElement).value, 10);
                const type = (form.elements.namedItem('type') as HTMLInputElement).value;
                onAddObject(width, height, type);
                form.reset();
            }}>
                <h4>Custom Object</h4>
                <div>
                    <label>
                        Type:
                        <input type="text" name="type" required />
                    </label>
                </div>
                <div>
                    <label>
                        Width:
                        <input type="number" name="width" required />
                    </label>
                </div>
                <div>
                    <label>
                        Height:
                        <input type="number" name="height" required />
                    </label>
                </div>
                <button type="submit" style={{ marginTop: '10px' }}>Add Custom Object</button>
            </form>
        </div>
    );
}