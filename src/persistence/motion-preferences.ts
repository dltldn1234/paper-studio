const KEY = 'paper-studio.motion-preferences.v1'
export const CINEMATIC_REVISION = 2
export const MOTION_PREFERENCES_EVENT = 'paper-studio:motion-preferences'

export function readMotionPreferences(): {
  reduce: boolean | null
  seen: boolean
} {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      reduce: typeof value.reduce === 'boolean' ? value.reduce : null,
      seen: value.revision === CINEMATIC_REVISION && value.seen === true,
    }
  } catch {
    return { reduce: null, seen: false }
  }
}

export function saveMotionPreferences(change: {
  reduce?: boolean
  seen?: boolean
}): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        revision: CINEMATIC_REVISION,
        ...readMotionPreferences(),
        ...change,
      }),
    )
  } catch {
    /* Preferences never block entry. */
  }
  window.dispatchEvent(
    new CustomEvent(MOTION_PREFERENCES_EVENT, { detail: change }),
  )
}
