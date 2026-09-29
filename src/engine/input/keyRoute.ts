import type { Action, InputOwner, KeyBinding } from '@/contracts/input';
import { defaultBindings } from '@/engine/input/bindings';

const EDITABLE_TAGS = new Set(['TEXTAREA', 'SELECT']);
const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isEditableElement(target: EventTarget | { tagName?: string; isContentEditable?: boolean; type?: string } | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { tagName?: string; isContentEditable?: boolean; type?: string };
  if (element.isContentEditable) return true;
  if (element.tagName === 'INPUT') return !NON_TEXT_INPUTS.has((element.type ?? 'text').toLowerCase());
  return EDITABLE_TAGS.has(element.tagName ?? '') || element.tagName === 'IFRAME';
}

export interface KeyDecision {
  /** Record the physical key for movement. False while an editable element has focus. */
  track: boolean;
  preventDefault: boolean;
  /** Blur the focused field instead of stepping the shell. */
  blurEditable: boolean;
  action: Action | null;
}

/**
 * Q, Esc and the perf key go through the binding table and the owner stack.
 * An editable focus (or an iframe) owns the keyboard: gameplay keys, Q and backtick do not fire.
 */
export function decideKey(
  code: string,
  editable: boolean,
  owner: InputOwner,
  pointerLocked: boolean,
  repeat: boolean,
  bindings: readonly KeyBinding[] = defaultBindings,
  composing = false,
): KeyDecision {
  if (editable) {
    return {
      track: false,
      preventDefault: false,
      blurEditable: code === 'Escape' && !repeat && !composing,
      action: null,
    };
  }
  const binding = bindings.find((item) => item.codes.includes(code));
  const escapeWhileLocked = binding?.action === 'escape' && pointerLocked;
  const allowed = Boolean(binding && (binding.owners.includes(owner) || escapeWhileLocked));
  const movement = code.startsWith('Arrow') || code === 'Space';
  return {
    track: true,
    preventDefault: allowed && movement,
    blurEditable: false,
    action: !repeat && allowed && binding ? binding.action : null,
  };
}
