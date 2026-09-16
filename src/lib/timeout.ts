/**
 * Settle with `promise`, or reject with `makeError()` if it takes longer than `ms`.
 *
 * The timer is always cleared once the race is decided. Left running it would
 * still fire after the work had succeeded -- building an error nobody wants and
 * holding the timer alive for the full deadline.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, makeError: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(makeError()), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
