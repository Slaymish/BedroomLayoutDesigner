import { memo, useState, type ReactNode } from 'react';
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
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);

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
              onActivate={() => onActivateRoom(room.id)}
              onRename={(name) => onRenameRoom(room.id, name)}
              onDelete={() => onDeleteRoom(room.id)}
              onDragStart={(roomId) => setDraggingRoomId(roomId)}
              onDragOver={() => {
                // Keep HTML5 DnD target hot; reorder only on drop.
              }}
              onDrop={(targetRoomId) => {
                if (draggingRoomId) {
                  onReorderRooms(draggingRoomId, targetRoomId);
                }
                setDraggingRoomId(null);
              }}
            >
              {renderRoomContent(room, isActive)}
            </RoomCard>
          );
        })}
      </div>
    </section>
  );
}

export default memo(RoomWorkspace);
