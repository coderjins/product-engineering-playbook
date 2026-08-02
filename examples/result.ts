/**
 * A dependency-free Result type for expected failures.
 *
 * Reserve thrown exceptions for programmer errors and truly unexpected states.
 * Validation, conflicts, and unavailable dependencies are usually better modeled
 * as values that every caller must handle.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export const map = <T, U, E>(
  result: Result<T, E>,
  transform: (value: T) => U,
): Result<U, E> => (result.ok ? ok(transform(result.value)) : result);

export const mapError = <T, E, F>(
  result: Result<T, E>,
  transform: (error: E) => F,
): Result<T, F> => (result.ok ? result : err(transform(result.error)));

export const flatMap = <T, U, E, F>(
  result: Result<T, E>,
  transform: (value: T) => Result<U, F>,
): Result<U, E | F> => (result.ok ? transform(result.value) : result);

export const match = <T, E, R>(
  result: Result<T, E>,
  handlers: {
    readonly ok: (value: T) => R;
    readonly err: (error: E) => R;
  },
): R => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));

export const unwrapOr = <T, E>(
  result: Result<T, E>,
  fallback: (error: E) => T,
): T => (result.ok ? result.value : fallback(result.error));

export const fromThrowable = <T, E>(
  action: () => T,
  onError: (cause: unknown) => E,
): Result<T, E> => {
  try {
    return ok(action());
  } catch (cause) {
    return err(onError(cause));
  }
};
