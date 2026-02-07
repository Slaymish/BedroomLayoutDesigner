import { memo, useCallback, useRef, type ReactNode } from 'react';
import type { RoomDesign } from '../types';
import type { Unit } from '../utils/units';
import RoomCard from './RoomCard';

interface RoomWorkspaceProps {
  rooms: RoomDesign[];
  activeRoomId: string;
  unit: Unit;
  onActivateRoom: (roomId: string) => void;
  onRenameRoom: (roomId: string, name: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onReorderRooms: (sourceRoomId: string, targetRoomId: string) => void;
  renderRoomContent: (room: RoomDesign, isActive: boolean) => ReactNode;
}

function RoomWorkspace({
  rooms,
  activeRoomId,
  unit,
  onActivateRoom,
  onRenameRoom,
  onDeleteRoom,
  onReorderRooms,
  renderRoomContent,
}: RoomWorkspaceProps) {
  const draggingRoomIdRef = useRef<string | null>(null);

  const handleDragStart = useCallback((roomId: string) => {
    draggingRoomIdRef.current = roomId;
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingRoomIdRef.current = null;
  }, []);

  const handleDrop = useCallback((targetRoomId: string) => {
    const sourceRoomId = draggingRoomIdRef.current;
    if (sourceRoomId) {
      onReorderRooms(sourceRoomId, targetRoomId);
    }
    draggingRoomIdRef.current = null;
  }, [onReorderRooms]);

  const handleDragOver = useCallback(() => {
    // Keep HTML5 DnD target hot; reorder only on drop.
  }, []);

  return (
    <section className="room-workspace-shell">
      <div className="room-workspace-list">
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;
          return (
            <RoomCard
              key={room.id}
              room={room}
              unit={unit}
              isActive={isActive}
              canDelete={rooms.length > 1}
              onActivate={onActivateRoom}
              onRename={onRenameRoom}
              onDelete={onDeleteRoom}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              renderRoomContent={renderRoomContent}
            />
          );
        })}
      </div>
    </section>
  );
}

export default memo(RoomWorkspace);
