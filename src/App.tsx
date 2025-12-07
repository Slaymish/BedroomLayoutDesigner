import { useState } from 'react'
import './App.css'
import AddObjectPanel from './components/AddObjectPanel'
import RoomCanvas from './components/RoomCanvas'
import EditObjectPanel from './components/EditObjectPanel'
import PreferencesPanel from './components/PreferencesPanel'
import type { RoomItem, Preferences } from './types'

function App() {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  const [preferences, setPreferences] = useState<Preferences>({
    gridSize: 30,
    gridColor: '#f0f0f0ff',
    unit: 'cm'
  });

  const handlePreferencesChange = (newPreferences: Preferences) => {
    setPreferences(newPreferences);
  };

  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false);

  const handleAddItem = (width: number, height: number, type: string) => {
    // TODO: get current room width/height to position new item in center
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
    <div className="min-h-screen bg-white">
      <header className="px-6 py-8 bg-white border-b border-gray-200">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">Bedroom Layout Designer</h1>
      </header>
      <main className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr_20rem] gap-6">
          <section className="w-full">
            <AddObjectPanel onAddObject={handleAddItem} unit={preferences.unit} />
          </section>
          <section className="w-full">
            <RoomCanvas 
              items={items} 
              onItemsChange={setItems} 
              onEditItem={handleEditItem}
              gridSize={preferences.gridSize}
              gridColor={preferences.gridColor}
              unit={preferences.unit}
            />
          </section>
          {editingItemId !== null && (
            <section className="w-full">
              <EditObjectPanel
                item={items.find(i => i.id === editingItemId)!}
                onClose={() => setEditingItemId(null)}
                onChange={handleUpdateItem}
                onRemove={handleRemoveItem}
                unit={preferences.unit}
              />
            </section>
          )}
        </div>
        {preferencesPanelOpen && (
          <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
              <button 
                className="text-gray-500 hover:text-gray-700 float-right text-4xl font-bold"
                onClick={() => setPreferencesPanelOpen(false)}
              >
                &times;
              </button>
              <PreferencesPanel onChange={handlePreferencesChange} preferences={preferences} />
            </div>
          </div>
        )}
        {!preferencesPanelOpen && (<button 
          className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700"
          onClick={() => setPreferencesPanelOpen(true)}
        >
          Preferences
        </button>)}
      </main>
    </div>
  )
}

export default App
