import { useState } from 'react'
import './App.css'
import AddObjectPanel from './components/AddObjectPanel'
import RoomCanvas from './components/RoomCanvas'
import EditObjectPanel from './components/EditObjectPanel'
import type { RoomItem } from './types'

function App() {
  const [items, setItems] = useState<RoomItem[]>([
    { id: 1, width: 30, height: 50, x: 50, y: 50 },
    { id: 2, width: 100, height: 100, x: 200, y: 100 },
    { id: 3, width: 200, height: 150, x: 400, y: 200 }
  ]);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  const handleAddItem = (width: number, height: number, type: string) => {
    const newItem: RoomItem = {
      id: Date.now(),
      width,
      height,
      x: 50, // Default start position
      y: 50,
      type
    };
    setItems([...items, newItem]);
  };

  const handleEditItem = (id: number | null) => {
    setEditingItemId(id);
  };

  const handleUpdateItem = (updatedItem: RoomItem) => {
    setItems(prevItems => prevItems.map(i => i.id === updatedItem.id ? updatedItem : i));
  };

  const handleRemoveItem = () => {
    if (editingItemId !== null) {
      setItems(prevItems => prevItems.filter(i => i.id !== editingItemId));
      setEditingItemId(null);
    }
  };

  return (
    <>
      <div className="p-4 border-b border-gray-300">
        <h1 className="text-2xl font-semibold mb-4">Bedroom Layout Designer</h1>
      </div>
      <div className="flex">
        <AddObjectPanel onAddObject={handleAddItem} />
        <RoomCanvas 
          items={items} 
          onItemsChange={setItems} 
          onEditItem={handleEditItem}
        />
        {editingItemId !== null && (
          <div className="ml-2 relative w-48">
             <EditObjectPanel
              item={items.find(i => i.id === editingItemId)!}
              onClose={() => setEditingItemId(null)}
              onChange={handleUpdateItem}
              onRemove={handleRemoveItem}
            />
          </div>
        )}
      </div>
    </>
  )
}

export default App
