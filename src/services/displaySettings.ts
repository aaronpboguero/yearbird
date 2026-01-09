/**
 * Display Settings Service (In-Memory)
 *
 * Stores display preferences in memory only.
 * Populated from cloud sync if enabled, otherwise uses defaults.
 */

// In-memory storage with defaults
let showTimedEvents = false
let matchDescription = false

/**
 * Gets whether single-day timed events should be shown in the calendar.
 */
export function getShowTimedEvents(): boolean {
  return showTimedEvents
}

/**
 * Sets whether single-day timed events should be shown in the calendar.
 */
export function setShowTimedEvents(value: boolean): void {
  showTimedEvents = value
}

/**
 * Gets whether event descriptions should be matched for categorization.
 */
export function getMatchDescription(): boolean {
  return matchDescription
}

/**
 * Sets whether event descriptions should be matched for categorization.
 */
export function setMatchDescription(value: boolean): void {
  matchDescription = value
}
