import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { CANVAS_FAILURE_MESSAGE, CANVAS_RELOAD_MESSAGE, CanvasBoundary } from '@/shell/CanvasBoundary';
import { useGlStore } from '@/state/gl';

describe('canvas error boundary', () => {
  it('shows a calm message when the canvas fails to start', () => {
    const boundary = new CanvasBoundary({ children: createElement('canvas') });
    expect(boundary.render()).toEqual(createElement('canvas'));
    boundary.state = CanvasBoundary.getDerivedStateFromError(new Error('WebGL2 context failed'));
    const webgl = boundary.render();
    expect(webgl).not.toEqual(createElement('canvas'));
    if (!webgl || typeof webgl !== 'object' || !('props' in webgl)) {
      throw new Error('expected a fallback element');
    }
    expect(webgl.props.role).toBe('alert');
    const webglText = JSON.stringify(webgl.props.children);
    expect(webglText).toContain(CANVAS_FAILURE_MESSAGE);
    expect(webglText).toContain('Reload');

    boundary.state = CanvasBoundary.getDerivedStateFromError(new Error('Failed to fetch dynamically imported module'));
    const chunk = boundary.render();
    if (!chunk || typeof chunk !== 'object' || !('props' in chunk)) {
      throw new Error('expected a fallback element');
    }
    expect(JSON.stringify(chunk.props.children)).toContain(CANVAS_RELOAD_MESSAGE);
  });

  it('keeps the canvas mounted when the error is a lost context', () => {
    const boundary = new CanvasBoundary({ children: createElement('canvas') });
    useGlStore.getState().lose();
    boundary.state = CanvasBoundary.getDerivedStateFromError(
      new TypeError("Cannot read properties of null (reading 'alpha')"),
    );
    expect(boundary.state.failed).toBe(false);
    expect(boundary.render()).toEqual(createElement('canvas'));
    useGlStore.setState({ lost: false, lostAt: null });
    boundary.state = CanvasBoundary.getDerivedStateFromError(
      new TypeError("Cannot read properties of null (reading 'alpha')"),
    );
    expect(boundary.state.failed).toBe(false);
  });
});
