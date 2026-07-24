import { useEffect, useMemo, useRef } from 'react'

/**
 * Returns a stable callback that invokes `fn` only after it has been idle for
 * `delay` milliseconds. Each call resets the pending timer, so only the
 * arguments from the *last* call survive (trailing debounce) — exactly what a
 * search input needs: type fast, fire once after the user pauses.
 *
 * `fn` is kept in a ref and read at fire time, so the returned callback keeps a
 * stable identity across renders even when `fn` is recreated — it never needs
 * to appear in a dependency array or re-trigger an effect.
 *
 * The pending timer is cleared on unmount so a late fire can't run after the
 * component is gone.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  // Always-current fn, read at fire time. Written on every render (no effect
  // needed) — the "latest ref" pattern used by useEvent-style hooks.
  const fnRef = useRef(fn)
  fnRef.current = fn

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Clear a pending fire if the component unmounts first.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return useMemo(
    () => (...args: Args) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fnRef.current(...args), delay)
    },
    [delay],
  )
}
