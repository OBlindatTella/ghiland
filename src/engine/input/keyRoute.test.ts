import { describe, expect, it } from 'vitest';
import { decideKey, isEditableElement } from '@/engine/input/keyRoute';

describe('decideKey', () => {
  it('routes Q, Esc and backtick through the owner that the binding allows', () => {
    expect(decideKey('KeyQ', false, 'world', true, false).action).toBe('toggleScreen');
    expect(decideKey('KeyQ', false, 'text', false, false).action).toBeNull();
    expect(decideKey('Backquote', false, 'ui', false, false).action).toBe('togglePerfHud');
    expect(decideKey('Backquote', false, 'text', false, false).action).toBeNull();
    expect(decideKey('Escape', false, 'ui', false, false).action).toBe('escape');
    expect(decideKey('Escape', false, 'world', true, false).action).toBe('escape');
    expect(decideKey('KeyQ', false, 'world', true, true).action).toBeNull();
  });

  it('lets Notes type Q, Space, arrows and backtick (S1-04)', () => {
    for (const code of ['KeyQ', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backquote']) {
      const decision = decideKey(code, true, 'text', false, false);
      expect(decision.action).toBeNull();
      expect(decision.preventDefault).toBe(false);
      expect(decision.track).toBe(false);
    }
  });

  it('lets an editable focus keep gameplay keys, Q, backtick, Space and arrows', () => {
    for (const code of ['KeyW', 'KeyQ', 'Backquote', 'Space', 'ArrowLeft']) {
      const decision = decideKey(code, true, 'world', true, false);
      expect(decision.action).toBeNull();
      expect(decision.track).toBe(false);
      expect(decision.preventDefault).toBe(false);
    }
    expect(decideKey('Escape', true, 'text', false, false).blurEditable).toBe(true);
    expect(decideKey('Escape', true, 'text', false, false).action).toBeNull();
  });

  it('prevents default on movement keys only while the world owns them', () => {
    expect(decideKey('ArrowUp', false, 'world', true, false).preventDefault).toBe(true);
    expect(decideKey('Space', false, 'world', true, false).preventDefault).toBe(false);
    expect(decideKey('ArrowUp', false, 'ui', false, false).preventDefault).toBe(false);
  });

  it('treats inputs, textareas, contenteditable and iframes as editable', () => {
    expect(isEditableElement({ tagName: 'INPUT' })).toBe(true);
    expect(isEditableElement({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isEditableElement({ tagName: 'IFRAME' })).toBe(true);
    expect(isEditableElement({ tagName: 'BUTTON' })).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });
});
