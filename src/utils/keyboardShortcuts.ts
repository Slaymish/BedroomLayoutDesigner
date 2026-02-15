export const isEditableEventTarget = (target: EventTarget | null): boolean => {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
};

export const isUnmodifiedDeleteShortcut = (
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>
): boolean => (
  (event.key === 'Delete' || event.key === 'Backspace') &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey
);

export const canDeleteActiveSelection = (
  selectedItemCount: number,
  onboardingComplete: boolean,
  isDimensionEditorOpen: boolean
): boolean => (
  selectedItemCount > 0 &&
  onboardingComplete &&
  !isDimensionEditorOpen
);
