import { memo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Pencil } from 'lucide-react';
import type { RoomDesign } from '../types';
import { fromBaseCm, type Unit } from '../utils/units';

interface RoomCardProps {
  room: RoomDesign;
  unit: Unit;
  isActive: boolean;
  uiStateToken: string;
  canDelete: boolean;
  onActivate: (roomId: string) => void;
  onEditDimensions: (roomId: string) => void;
  onRename: (roomId: string, name: string) => void;
  onDelete: (roomId: string) => void;
  showReorderControls: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: (roomId: string) => void;
  onMoveDown: (roomId: string) => void;
  renderRoomContent: (room: RoomDesign, isActive: boolean) => ReactNode;
}

const formatDimension = (valueCm: number, unit: Unit): string => {
  const converted = fromBaseCm(valueCm, unit);
  const decimals = unit === 'm' || unit === 'ft' ? 2 : 1;
  return `${Number(converted.toFixed(decimals))}${unit}`;
};

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return !!target.closest('input, textarea, select, button, a, summary, [role="button"], [data-room-interactive]');
};

function RoomCard({
  room,
  unit,
  isActive,
  uiStateToken,
  canDelete,
  onActivate,
  onEditDimensions,
  onRename,
  onDelete,
  showReorderControls,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
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
      data-ui-state-token={uiStateToken}
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return;
        onActivate(room.id);
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
              <h3 className="truncate text-base font-semibold room-card-title">{room.name}</h3>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <p className="text-xs room-card-dimensions">
              {formatDimension(room.roomWidthCm, unit)} x {formatDimension(room.roomHeightCm, unit)}
            </p>
            <button
              className="ui-btn ui-btn-subtle room-dimension-edit-btn"
              onClick={(event) => {
                event.stopPropagation();
                onEditDimensions(room.id);
              }}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              title="Edit room dimensions"
              aria-label={`Edit dimensions for ${room.name}`}
            >
              <Pencil className="room-dimension-edit-btn-icon" />
            </button>
          </div>
          <p className="text-[11px] room-card-meta">{room.items.length} objects · {openingCount} openings</p>
        </div>
        <div className="flex items-center gap-2">
          {showReorderControls && (
            <>
              <button
                className="ui-btn ui-btn-subtle min-h-0 px-2 py-1.5 text-xs disabled:opacity-45"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!canMoveUp) return;
                  onMoveUp(room.id);
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                disabled={!canMoveUp}
                aria-label={`Move ${room.name} up`}
                title="Move room up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                className="ui-btn ui-btn-subtle min-h-0 px-2 py-1.5 text-xs disabled:opacity-45"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!canMoveDown) return;
                  onMoveDown(room.id);
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                disabled={!canMoveDown}
                aria-label={`Move ${room.name} down`}
                title="Move room down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
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
  prev.uiStateToken === next.uiStateToken &&
  prev.canDelete === next.canDelete &&
  prev.onActivate === next.onActivate &&
  prev.onEditDimensions === next.onEditDimensions &&
  prev.onRename === next.onRename &&
  prev.onDelete === next.onDelete &&
  prev.showReorderControls === next.showReorderControls &&
  prev.canMoveUp === next.canMoveUp &&
  prev.canMoveDown === next.canMoveDown &&
  prev.onMoveUp === next.onMoveUp &&
  prev.onMoveDown === next.onMoveDown
);

export default memo(RoomCard, roomCardPropsEqual);
