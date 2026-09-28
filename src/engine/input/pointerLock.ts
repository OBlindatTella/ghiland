const GESTURE_DENIED = new Set(['NotAllowedError', 'SecurityError', 'InvalidStateError']);

function errorName(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) return error.name;
  return '';
}

/**
 * `'event'` means `requestPointerLock` returned no promise.
 * Success or failure then arrives as `pointerlockchange` or `pointerlockerror`.
 * Resolving `undefined` would clear the pending request before that error is delivered.
 */
export type PointerLockRequest = Promise<void> | 'event';

/**
 * Asks the browser to lock the pointer on `el`.
 * `{ unadjustedMovement: true }` is requested where it is supported.
 * A denied gesture is not retried. An unsupported-option failure is tried once without the option.
 */
export function requestCanvasPointerLock(el: HTMLElement): PointerLockRequest {
  const request = (options?: { unadjustedMovement?: boolean }): PointerLockRequest => {
    try {
      const result = el.requestPointerLock(options as PointerLockOptions) as void | Promise<void>;
      if (result && typeof result.then === 'function') return result;
      return 'event';
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const first = request({ unadjustedMovement: true });
  if (first === 'event') return first;
  return first.catch((error: unknown) => {
    if (GESTURE_DENIED.has(errorName(error))) throw error;
    const second = request();
    // No promise: leave the caller pending until pointerlockchange or pointerlockerror.
    if (second === 'event') return new Promise<void>(() => {});
    return second;
  });
}
