/**
 * Returns an AbortSignal that fires after `ms`, and a `release` function to clear the timer
 * once the guarded work has finished. Prefer this over `AbortSignal.timeout` so the caller
 * can also link an upstream signal (for example the client disconnecting).
 */
export function timeoutSignal(
  ms: number,
  parent?: AbortSignal
): { signal: AbortSignal; release: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
    ms
  );

  const onParentAbort = () => controller.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) onParentAbort();
    else parent.addEventListener('abort', onParentAbort, { once: true });
  }

  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onParentAbort);
    },
  };
}

export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' ||
      (error.name === 'AbortError' && /timed out/i.test(error.message)))
  );
}
