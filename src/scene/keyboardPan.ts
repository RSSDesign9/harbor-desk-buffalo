/** Screen direction; leave modified shortcuts to the browser and other controls. */
export function keyboardPanDirection(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'defaultPrevented'>): [number, number] | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  switch (event.key) {
    case 'ArrowLeft': return [-1, 0];
    case 'ArrowRight': return [1, 0];
    case 'ArrowUp': return [0, -1];
    case 'ArrowDown': return [0, 1];
    default: return null;
  }
}

export const KEYBOARD_PAN_PX = 48;
export const MAP_KEYBOARD_HELP = 'Use arrow keys to pan the map. Press Tab to move to the next control.';
