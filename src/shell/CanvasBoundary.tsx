'use client';

import { Component, type ReactNode } from 'react';

export const CANVAS_FAILURE_MESSAGE =
  "This place needs WebGL2, and this browser couldn't start it.";

interface BoundaryState {
  failed: boolean;
}

/**
 * Catches a WebGL2 context failure or a failed engine chunk inside GhilandApp.
 * The canvas lives in the root layout, so a route error boundary would miss it.
 */
export class CanvasBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="absolute inset-0 z-50 flex items-center justify-center bg-[#1c1814] px-8 text-center text-[15px] leading-6 text-[#f2f0eb]"
        >
          {CANVAS_FAILURE_MESSAGE}
        </div>
      );
    }
    return this.props.children;
  }
}
