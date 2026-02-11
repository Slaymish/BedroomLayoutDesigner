import { memo, useCallback, type ReactNode } from 'react';
import type { RoomDesign } from '../types';
import type { Unit } from '../utils/units';
import RoomCard from './RoomCard';

interface RoomWorkspaceProps {
  rooms: RoomDesign[];
  activeRoomId: string;
  unit: Unit;
  roomUiStateTokens: Record<string, string>;
  onActivateRoom: (roomId: string) => void;
  onEditRoomDimensions: (roomId: string) => void;
  onRenameRoom: (roomId: string, name: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onReorderRooms: (sourceRoomId: string, targetRoomId: string) => void;
  renderRoomContent: (room: RoomDesign, isActive: boolean) => ReactNode;
}

function RoomWorkspace({
  rooms,
  activeRoomId,
  unit,
  roomUiStateTokens,
  onActivateRoom,
  onEditRoomDimensions,
  onRenameRoom,
  onDeleteRoom,
  onReorderRooms,
  renderRoomContent,
}: RoomWorkspaceProps) {
  const handleMoveUp = useCallback((roomId: string) => {
    const index = rooms.findIndex((room) => room.id === roomId);
    if (index <= 0) return;
    onReorderRooms(roomId, rooms[index - 1].id);
  }, [onReorderRooms, rooms]);

  const handleMoveDown = useCallback((roomId: string) => {
    const index = rooms.findIndex((room) => room.id === roomId);
    if (index < 0 || index >= rooms.length - 1) return;
    onReorderRooms(roomId, rooms[index + 1].id);
  }, [onReorderRooms, rooms]);

  return (
    <section className="room-workspace-shell">
      <div className="room-workspace-list">
        {rooms.map((room, index) => {
          const isActive = room.id === activeRoomId;
          return (
            <RoomCard
              key={room.id}
              room={room}
              unit={unit}
              isActive={isActive}
              uiStateToken={roomUiStateTokens[room.id] || ''}
              canDelete={rooms.length > 1}
              onActivate={onActivateRoom}
              onEditDimensions={onEditRoomDimensions}
              onRename={onRenameRoom}
              onDelete={onDeleteRoom}
              showReorderControls={rooms.length > 1}
              canMoveUp={index > 0}
              canMoveDown={index < rooms.length - 1}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              renderRoomContent={renderRoomContent}
            />
          );
        })}
      </div>
    </section>
  );
}

export default memo(RoomWorkspace);
