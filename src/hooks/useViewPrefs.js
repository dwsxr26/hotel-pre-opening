import { useCallback, useEffect, useRef, useState } from 'react'
import { loadViewPrefs, saveViewPrefs } from '../data/viewPrefs'

// Loads this user's saved view state once, then debounces writes back to
// Supabase whenever it changes. `enabled` gates loading until we have a session.
export function useViewPrefs(enabled, defaults, key = 'orders') {
  const [prefs, setPrefs] = useState(defaults)
  const [ready, setReady] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadViewPrefs(key)
      .then((saved) => {
        if (cancelled) return
        if (!saved) return
        let s = saved
        // If the column layout version moved on, drop the saved order/sizing so
        // the user picks up the new default layout.
        if (defaults.columnsVersion != null && saved.columnsVersion !== defaults.columnsVersion) {
          const { columnOrder, columnSizing, ...rest } = saved // eslint-disable-line no-unused-vars
          s = { ...rest, columnsVersion: defaults.columnsVersion }
        }
        setPrefs((prev) => ({ ...prev, ...s }))
      })
      .catch((err) => console.error('Failed to load view prefs', err))
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [enabled, key, defaults.columnsVersion])

  // Merge a partial update and schedule a debounced save.
  const update = useCallback(
    (patch) => {
      setPrefs((prev) => {
        const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }
        if (ready) {
          clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => {
            saveViewPrefs(next, key).catch((err) => console.error('Failed to save view prefs', err))
          }, 500)
        }
        return next
      })
    },
    [ready, key],
  )

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  return { prefs, update, ready }
}
