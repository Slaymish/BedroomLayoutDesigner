import { useMemo, useRef, useState } from 'react'
import './App.css'
import AddObjectPanel from './components/AddObjectPanel'
import RoomCanvas from './components/RoomCanvas'
import EditObjectPanel from './components/EditObjectPanel'
import PreferencesPanel from './components/PreferencesPanel'
import type { RoomItem, Preferences } from './types'

function App() {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const nextItemId = useRef(1);

  const [preferences, setPreferences] = useState<Preferences>({
    gridSize: 30,
    gridColor: '#c8d2dd',
    unit: 'cm'
  });

  const handlePreferencesChange = (newPreferences: Preferences) => {
    setPreferences(newPreferences);
  };

  const [preferencesPanelOpen, setPreferencesPanelOpen] = useState(false);

  const handleAddItem = (width: number, height: number, type: string) => {
    const newId = nextItemId.current++;
    const newItem: RoomItem = {
      id: newId,
      width,
      height,
      x: 0,
      y: 0,
      type
    };

    setItems(prevItems => {
      const offset = 36 + (prevItems.length % 8) * 22;
      return [...prevItems, { ...newItem, x: offset, y: offset }];
    });
    setEditingItemId(newId);
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

  const editingItem = useMemo(
    () => (editingItemId !== null ? items.find(i => i.id === editingItemId) || null : null),
    [editingItemId, items]
  );

  return (
    <div className="min-h-screen app-shell">
      <header className="px-5 py-8 md:px-8 md:py-10 border-b border-slate-200/70">
        <div className="mx-auto max-w-[1500px]">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Bedroom Layout Designer</h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">Add furniture presets, drag to position, and fine-tune dimensions from the edit panel.</p>
        </div>
      </header>
      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1500px] grid grid-cols-1 xl:grid-cols-[21rem_1fr_21rem] gap-5 lg:gap-6 items-start">
          <section className="w-full">
            <AddObjectPanel onAddObject={handleAddItem} unit={preferences.unit} />
          </section>
          <section className="w-full space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Drag objects to move. Drag canvas edges to resize room.
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="w-max min-w-[720px]">
                <RoomCanvas
                  items={items}
                  onItemsChange={setItems}
                  onEditItem={handleEditItem}
                  selectedItemId={editingItem?.id ?? null}
                  gridSize={preferences.gridSize}
                  gridColor={preferences.gridColor}
                  unit={preferences.unit}
                />
              </div>
            </div>
          </section>
          <section className="w-full">
            {editingItem ? (
              <EditObjectPanel
                item={editingItem}
                onClose={() => setEditingItemId(null)}
                onChange={handleUpdateItem}
                onRemove={handleRemoveItem}
                unit={preferences.unit}
              />
            ) : (
              <div className="p-4 border border-slate-200 bg-white rounded-2xl shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Edit Object</h3>
                <p className="mt-2 text-sm text-slate-600">Select any object on the canvas to edit size, position, or rotation.</p>
              </div>
            )}
          </section>
        </div>
        {preferencesPanelOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[1px]">
            <div className="bg-white p-5 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Layout Preferences</h2>
                <button
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setPreferencesPanelOpen(false)}
                >
                  Close
                </button>
              </div>
              <PreferencesPanel onChange={handlePreferencesChange} preferences={preferences} />
            </div>
          </div>
        )}
        {!preferencesPanelOpen && (
          <button
            className="fixed bottom-5 right-5 md:bottom-6 md:right-6 bg-slate-900 text-white rounded-full px-4 py-3 shadow-lg hover:bg-slate-700 transition-colors"
            onClick={() => setPreferencesPanelOpen(true)}
          >
            Preferences
          </button>
        )}
      </main>
    </div>
  )
}

export default App
