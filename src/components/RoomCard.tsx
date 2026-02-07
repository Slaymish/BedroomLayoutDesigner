import { memo, useState, type ReactNode } from 'react';
import type { RoomDesign } from '../types';
import { fromBaseCm, type Unit } from '../utils/units';

interface RoomCardProps {
  room: RoomDesign;
  unit: Unit;
  isActive: boolean;
  canDelete: boolean;
  onActivate: (roomId: string) => void;
  onRename: (roomId: string, name: string) => void;
  onDelete: (roomId: string) => void;
  onDragStart: (roomId: string) => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: (roomId: string) => void;
  renderRoomContent: (room: RoomDesign, isActive: boolean) => ReactNode;
}

const formatDimension = (valueCm: number, unit: Unit): string => {
  const converted = fromBaseCm(valueCm, unit);
  const decimals = unit === 'm' || unit === 'ft' ? 2 : 1;
  return `${Number(converted.toFixed(decimals))}${unit}`;
};

function RoomCard({
  room,
  unit,
  isActive,
  canDelete,
  onActivate,
  onRename,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  renderRoomContent,
}: RoomCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(room.name);
  const openingCount = room.items.filter((item) => item.type === 'Door' || item.type === 'Window').length;

  const submitRename = () => {
    const nextName = nameDraft.trim();
    if (nextName) {
      onRename(room.id, nextName);
    } else {
      setNameDraft(room.name);
    }
    setIsRenaming(false);
  };

  return (
    <article
      className={`surface-card room-card ${isActive ? 'room-card-active' : ''}`}
      onMouseDown={() => onActivate(room.id)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
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
          <p className="text-[11px] text-slate-500">{room.items.length} objects · {openingCount} openings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="ui-btn ui-btn-subtle min-h-0 px-2.5 py-1.5 text-xs cursor-grab active:cursor-grabbing"
            draggable={!isRenaming}
            onDragStart={(event) => {
              event.stopPropagation();
              onDragStart(room.id);
            }}
            onDragEnd={(event) => {
              event.stopPropagation();
              onDragEnd();
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
              onDelete(room.id);
            }}
            disabled={!canDelete}
          >
            Delete
          </button>
        </div>
      </header>
      <div className="room-card-body">
        {renderRoomContent(room, isActive)}
      </div>
    </article>
  );
}

const roomCardPropsEqual = (prev: RoomCardProps, next: RoomCardProps): boolean => (
  prev.room === next.room &&
  prev.unit === next.unit &&
  prev.isActive === next.isActive &&
  prev.canDelete === next.canDelete &&
  prev.onActivate === next.onActivate &&
  prev.onRename === next.onRename &&
  prev.onDelete === next.onDelete &&
  prev.onDragStart === next.onDragStart &&
  prev.onDragEnd === next.onDragEnd &&
  prev.onDragOver === next.onDragOver &&
  prev.onDrop === next.onDrop &&
  prev.renderRoomContent === next.renderRoomContent
);

export default memo(RoomCard, roomCardPropsEqual);
