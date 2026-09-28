import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { CANVAS_FAILURE_MESSAGE, CanvasBoundary } from '@/shell/CanvasBoundary';

describe('canvas error boundary', () => {
  it('shows a calm message when the canvas fails to start', () => {
    const boundary = new CanvasBoundary({ children: createElement('canvas') });
    expect(boundary.render()).toEqual(createElement('canvas'));
    boundary.state = CanvasBoundary.getDerivedStateFromError();
    const view = boundary.render();
    expect(view).not.toEqual(createElement('canvas'));
    if (!view || typeof view !== 'object' || !('props' in view)) {
      throw new Error('expected a fallback element');
    }
    expect(view.props.role).toBe('alert');
    expect(view.props.children).toBe(CANVAS_FAILURE_MESSAGE);
  });
});
