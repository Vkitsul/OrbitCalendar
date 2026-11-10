/** Shared state for HTML5 drag & drop (dataTransfer can't be read during dragover) */
export type DragPayload =
  | { kind: 'task'; id: string; duration: number; title: string }
  | { kind: 'occ'; key: string; fromDay: number }
  | null;

let current: DragPayload = null;

export const dnd = {
  set(p: DragPayload) {
    current = p;
  },
  get() {
    return current;
  },
  clear() {
    current = null;
  },
};
