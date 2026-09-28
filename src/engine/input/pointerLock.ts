const GESTURE_DENIED = new Set(['NotAllowedError', 'SecurityError', 'InvalidStateError']);

function errorName(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) return error.name;
  return '';
}

/**
 * Asks the browser to lock the pointer on `el`.
 * `{ unadjustedMovement: true }` is requested where it is supported.
 * A denied gesture is not retried. An unsupported-option failure is tried once without the option.
 */
export function requestCanvasPointerLock(el: HTMLElement): Promise<void> {
  const request = (options?: { unadjustedMovement?: boolean }) => {
    try {
      const result = el.requestPointerLock(options as PointerLockOptions);
      return Promise.resolve(result as void | Promise<void>);
    } catch (error) {
      return Promise.reject(error);
    }
  };

  return request({ unadjustedMovement: true }).catch((error: unknown) => {
    if (GESTURE_DENIED.has(errorName(error))) throw error;
    return request();
  });
}
