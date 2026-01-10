/**
 * Cache Service (No-op)
 *
 * Previously cached events in localStorage.
 * Now disabled - events are fetched fresh each session.
 * Functions maintain signatures for API compatibility but do nothing.
 */

import type { YearbirdEvent } from '../types/calendar'

/**
 * Get cached events (always returns null - caching disabled).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getCachedEvents(year: number, suffix?: string): YearbirdEvent[] | null {
  return null
}

/**
 * Set cached events (no-op - caching disabled).
 */
export function setCachedEvents(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  year: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  events: YearbirdEvent[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  suffix?: string
): void {
  // No-op: caching disabled
}

/**
 * Clear cached events for a year (no-op - caching disabled).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function clearCachedEvents(year: number, suffix?: string): void {
  // No-op: caching disabled
}

/**
 * Clear all caches (no-op - caching disabled).
 */
export function clearAllCaches(): void {
  // No-op: caching disabled
}

/**
 * Clear all event caches (no-op - caching disabled).
 */
export function clearEventCaches(): void {
  // No-op: caching disabled
}

/**
 * Get cache timestamp (always returns null - caching disabled).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getCacheTimestamp(year: number, suffix?: string): Date | null {
  return null
}
