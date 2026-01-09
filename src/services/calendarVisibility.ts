/**
 * Calendar Visibility Service (In-Memory)
 *
 * Stores disabled calendar IDs in memory only.
 * Populated from cloud sync if enabled, otherwise starts empty.
 */

// In-memory storage
let disabledCalendars: string[] = []

const normalizeDisabled = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const entries = value.filter((entry): entry is string => typeof entry === 'string')
  return [...new Set(entries.map((entry) => entry.trim()).filter(Boolean))]
}

/**
 * Get all disabled calendar IDs.
 */
export function getDisabledCalendars(): string[] {
  return [...disabledCalendars]
}

/**
 * Set all disabled calendars (used by cloud sync to populate state).
 */
export function setDisabledCalendars(disabled: string[]): string[] {
  disabledCalendars = normalizeDisabled(disabled)
  return [...disabledCalendars]
}

/**
 * Disable a calendar by ID.
 */
export function disableCalendar(id: string): string[] {
  if (disabledCalendars.includes(id)) {
    return [...disabledCalendars]
  }
  disabledCalendars = [...disabledCalendars, id]
  return [...disabledCalendars]
}

/**
 * Enable a calendar by ID.
 */
export function enableCalendar(id: string): string[] {
  if (!disabledCalendars.includes(id)) {
    return [...disabledCalendars]
  }
  disabledCalendars = disabledCalendars.filter((entry) => entry !== id)
  return [...disabledCalendars]
}
