import { describe, expect, it } from 'vitest'
import {
  clearAllCaches,
  clearCachedEvents,
  clearEventCaches,
  getCachedEvents,
  getCacheTimestamp,
  setCachedEvents,
} from './cache'
import type { YearbirdEvent } from '../types/calendar'

describe('cache service (no-op)', () => {
  const events: YearbirdEvent[] = [
    {
      id: '1',
      title: 'Trip',
      startDate: '2026-01-01',
      endDate: '2026-01-03',
      isAllDay: true,
      isMultiDay: true,
      durationDays: 2,
      googleLink: '',
      category: 'uncategorized',
      color: '#9CA3AF',
    },
  ]

  it('getCachedEvents always returns null (caching disabled)', () => {
    expect(getCachedEvents(2026)).toBeNull()
    expect(getCachedEvents(2025)).toBeNull()
    expect(getCachedEvents(2026, 'suffix')).toBeNull()
  })

  it('setCachedEvents is a no-op (caching disabled)', () => {
    // Should not throw
    expect(() => setCachedEvents(2026, events)).not.toThrow()
    expect(() => setCachedEvents(2026, events, 'suffix')).not.toThrow()

    // Still returns null after "setting"
    expect(getCachedEvents(2026)).toBeNull()
  })

  it('clearCachedEvents is a no-op (caching disabled)', () => {
    expect(() => clearCachedEvents(2026)).not.toThrow()
    expect(() => clearCachedEvents(2026, 'suffix')).not.toThrow()
  })

  it('clearAllCaches is a no-op (caching disabled)', () => {
    expect(() => clearAllCaches()).not.toThrow()
  })

  it('clearEventCaches is a no-op (caching disabled)', () => {
    expect(() => clearEventCaches()).not.toThrow()
  })

  it('getCacheTimestamp always returns null (caching disabled)', () => {
    expect(getCacheTimestamp(2026)).toBeNull()
    expect(getCacheTimestamp(2025)).toBeNull()
    expect(getCacheTimestamp(2026, 'suffix')).toBeNull()
  })
})
