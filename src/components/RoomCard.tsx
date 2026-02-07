import { useState, type ReactNode } from 'react';
import type { RoomDesign } from '../types';
import { fromBaseCm, type Unit } from '../utils/units';

interface RoomCardProps {
  room: RoomDesign;
  unit: Unit;
  isActive: boolean;
  canDelete: boolean;
  onActivate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDragStart: (roomId: string) => void;
  onDragOver: (roomId: string) => void;
  onDrop: (roomId: string) => void;
  children: ReactNode;
}

const formatDimension = (valueCm: number, unit: Unit): string => {
  const converted = fromBaseCm(valueCm, unit);
  const decimals = unit === 'm' || unit === 'ft' ? 2 : 1;
  return `${Number(converted.toFixed(decimals))}${unit}`;
};

export default function RoomCard({
  room,
  unit,
  isActive,
  canDelete,
  onActivate,
  onRename,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: RoomCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(room.name);

  const submitRename = () => {
    const nextName = nameDraft.trim();
    if (nextName) {
      onRename(nextName);
    } else {
      setNameDraft(room.name);
    }
    setIsRenaming(false);
  };

  return (
    <article
      className={`surface-card room-card ${isActive ? 'room-card-active' : ''}`}
      onMouseDown={onActivate}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(room.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(room.id);
      }}
    >
      <header className="room-card-header">
        <div className="min-w-0">
          {isRenaming ? (
            <input
              className="ui-input w-full"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={submitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitRename();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setNameDraft(room.name);
                  setIsRenaming(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-900">{room.name}</h3>
              <span className={`room-card-status ${room.setup.onboardingComplete ? 'ready' : 'setup'}`}>
                {room.setup.onboardingComplete ? 'Ready' : 'Setup required'}
              </span>
            </div>
          )}
          <p className="text-xs text-slate-600">
            {formatDimension(room.roomWidthCm, unit)} x {formatDimension(room.roomHeightCm, unit)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs cursor-grab active:cursor-grabbing"
            draggable={!isRenaming}
            onDragStart={(event) => {
              event.stopPropagation();
              onDragStart(room.id);
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            aria-label={`Drag to reorder ${room.name}`}
            title="Drag to reorder room"
          >
            Reorder
          </button>
          {!isRenaming && (
            <button
              className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs"
              onClick={(event) => {
                event.stopPropagation();
                setNameDraft(room.name);
                setIsRenaming(true);
              }}
            >
              Rename
            </button>
          )}
          <button
            className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs disabled:opacity-45"
            onClick={(event) => {
              event.stopPropagation();
              if (!canDelete) return;
              onDelete();
            }}
            disabled={!canDelete}
          >
            Delete
          </button>
        </div>
      </header>
      <div className="room-card-body">
        {children}
      </div>
    </article>
  );
}
