/**
 * Display Settings Service (In-Memory)
 *
 * Stores display preferences in memory only.
 * Populated from cloud sync if enabled, otherwise uses defaults.
 */

// In-memory storage with defaults
let showTimedEvents = false
let matchDescription = false
let weekViewEnabled = false
let monthScrollEnabled = false
let monthScrollDensity = 60

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

/**
 * Gets whether week view (Mon-Sun columns) is enabled instead of month view.
 */
export function getWeekViewEnabled(): boolean {
  return weekViewEnabled
}

/**
 * Sets whether week view is enabled.
 */
export function setWeekViewEnabled(value: boolean): void {
  weekViewEnabled = value
}

/**
 * Gets whether month scroll mode is enabled.
 */
export function getMonthScrollEnabled(): boolean {
  return monthScrollEnabled
}

/**
 * Sets whether month scroll mode is enabled.
 */
export function setMonthScrollEnabled(value: boolean): void {
  monthScrollEnabled = value
}

/**
 * Gets the month scroll density (row height in pixels).
 */
export function getMonthScrollDensity(): number {
  return monthScrollDensity
}

/**
 * Sets the month scroll density (row height in pixels).
 */
export function setMonthScrollDensity(value: number): void {
  monthScrollDensity = value
}
