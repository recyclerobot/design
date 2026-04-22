import { useEffect } from 'react';
import { useEditor, flatObjects } from '../editor/store';
import type { LayerObject } from '../editor/types';

const isEditableTarget = (t: EventTarget | null) => {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

function findObject(id: string | null): LayerObject | undefined {
  if (!id) return undefined;
  for (const { object } of flatObjects(useEditor.getState().doc)) {
    if (object.id === id) return object;
  }
  return undefined;
}

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const s = useEditor.getState();
      const id = s.selectedObjectId;

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'd' && id) {
        e.preventDefault();
        s.duplicateObject(id);
        for (const aid of s.additionalSelectedObjectIds) s.duplicateObject(aid);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && id) {
        e.preventDefault();
        const additional = [...s.additionalSelectedObjectIds];
        s.removeObject(id);
        for (const aid of additional) s.removeObject(aid);
        return;
      }
      if (e.key === '[' && id) {
        s.reorderObject(id, -1);
        return;
      }
      if (e.key === ']' && id) {
        s.reorderObject(id, 1);
        return;
      }
      if (e.key.toLowerCase() === 't' && !meta) {
        e.preventDefault();
        s.addTextObject();
        return;
      }

      if (id && e.key.startsWith('Arrow')) {
        const obj = findObject(id);
        if (!obj) return;
        const step = e.shiftKey ? 10 : 1;
        let dx = 0,
          dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        e.preventDefault();
        s.updateObject(id, { x: obj.x + dx, y: obj.y + dy } as Partial<LayerObject>);
        for (const aid of s.additionalSelectedObjectIds) {
          const ao = findObject(aid);
          if (!ao) continue;
          s.updateObject(aid, { x: ao.x + dx, y: ao.y + dy } as Partial<LayerObject>);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
