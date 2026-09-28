'use client';

import { Component, type ReactNode } from 'react';

export const CANVAS_FAILURE_MESSAGE =
  "This place needs WebGL2, and this browser couldn't start it.";

export const CANVAS_RELOAD_MESSAGE = "This place didn't load. Reload the page to try again.";

interface BoundaryState {
  failed: boolean;
  webgl: boolean;
}

/**
 * Catches a WebGL2 context failure or a failed engine chunk inside GhilandApp.
 * The canvas lives in the root layout, so a route error boundary would miss it.
 */
export class CanvasBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false, webgl: false };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return { failed: true, webgl: /webgl/i.test(message) };
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#1c1814] px-8 text-center text-[15px] leading-6 text-[#f2f0eb]"
        >
          <p>{this.state.webgl ? CANVAS_FAILURE_MESSAGE : CANVAS_RELOAD_MESSAGE}</p>
          <button
            type="button"
            className="rounded-[6px] border border-white/10 bg-[#141413] px-3 py-2 text-[13px] leading-5"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
