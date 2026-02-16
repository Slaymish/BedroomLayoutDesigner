export const resolveRoomSelectedItemIds = (
  selectedItemIdsByRoom: Record<string, number[]>,
  roomId: string,
  editingItemId: number | null
): number[] => {
  const explicit = selectedItemIdsByRoom[roomId];
  if (Object.prototype.hasOwnProperty.call(selectedItemIdsByRoom, roomId)) {
    return explicit ?? [];
  }
  return editingItemId === null ? [] : [editingItemId];
};
