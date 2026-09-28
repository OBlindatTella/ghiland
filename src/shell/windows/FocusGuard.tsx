'use client';

import { useEffect } from 'react';
import { isEditableElement } from '@/engine/input/keyRoute';
import { inputManager } from '@/engine/input/InputManager';
import { useInputStore } from '@/state/input';

const FOCUSABLE = 'button, a[href], input, textarea, select, [tabindex="0"]';

/** Tab stays inside the Screen. A text field pushes the text owner and drops it on blur. */
export function FocusGuard() {
  const shell = useInputStore((state) => state.shellState);

  useEffect(() => {
    if (shell !== 'SCREEN') return;
    let token: number | null = null;
    let timer = 0;
    const syncOwner = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const editable = isEditableElement(document.activeElement);
        if (editable && token === null) token = inputManager.pushOwner('text');
        if (!editable && token !== null) {
          inputManager.popOwner(token);
          token = null;
        }
      }, 0);
    };
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const root = document.querySelector('[data-ghiland-screen]');
      if (!root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (item) => !item.hidden && item.tabIndex !== -1 && !item.hasAttribute('disabled'),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!(active instanceof Node) || !root.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('focusin', syncOwner);
    document.addEventListener('focusout', syncOwner);
    window.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('focusin', syncOwner);
      document.removeEventListener('focusout', syncOwner);
      window.removeEventListener('keydown', onTab);
      window.clearTimeout(timer);
      if (token !== null) inputManager.popOwner(token);
    };
  }, [shell]);

  return null;
}
