import { beforeEach, describe, expect, it } from 'vitest'
import {
  getShowTimedEvents,
  setShowTimedEvents,
  getMatchDescription,
  setMatchDescription,
  getWeekViewEnabled,
  setWeekViewEnabled,
  getMonthScrollEnabled,
  setMonthScrollEnabled,
  getMonthScrollDensity,
  setMonthScrollDensity,
} from './displaySettings'

describe('displaySettings (in-memory)', () => {
  // Reset to defaults before each test
  beforeEach(() => {
    setShowTimedEvents(false)
    setMatchDescription(false)
    setWeekViewEnabled(false)
    setMonthScrollEnabled(false)
    setMonthScrollDensity(60)
  })

  describe('getShowTimedEvents', () => {
    it('returns false by default', () => {
      expect(getShowTimedEvents()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setShowTimedEvents(true)
      expect(getShowTimedEvents()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setShowTimedEvents(true)
      expect(getShowTimedEvents()).toBe(true)
      setShowTimedEvents(false)
      expect(getShowTimedEvents()).toBe(false)
    })
  })

  describe('setShowTimedEvents', () => {
    it('updates the in-memory state', () => {
      expect(getShowTimedEvents()).toBe(false)
      setShowTimedEvents(true)
      expect(getShowTimedEvents()).toBe(true)
    })
  })

  describe('getMatchDescription', () => {
    it('returns false by default', () => {
      expect(getMatchDescription()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
      setMatchDescription(false)
      expect(getMatchDescription()).toBe(false)
    })
  })

  describe('setMatchDescription', () => {
    it('updates the in-memory state', () => {
      expect(getMatchDescription()).toBe(false)
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
    })
  })

  describe('weekViewEnabled - regression tests for cloud sync', () => {
    it('returns false by default', () => {
      expect(getWeekViewEnabled()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setWeekViewEnabled(true)
      expect(getWeekViewEnabled()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setWeekViewEnabled(true)
      expect(getWeekViewEnabled()).toBe(true)
      setWeekViewEnabled(false)
      expect(getWeekViewEnabled()).toBe(false)
    })

    it('persists value in memory between get calls', () => {
      setWeekViewEnabled(true)
      expect(getWeekViewEnabled()).toBe(true)
      expect(getWeekViewEnabled()).toBe(true) // Same value on subsequent call
    })
  })

  describe('monthScrollEnabled - regression tests for cloud sync', () => {
    it('returns false by default', () => {
      expect(getMonthScrollEnabled()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setMonthScrollEnabled(true)
      expect(getMonthScrollEnabled()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setMonthScrollEnabled(true)
      expect(getMonthScrollEnabled()).toBe(true)
      setMonthScrollEnabled(false)
      expect(getMonthScrollEnabled()).toBe(false)
    })
  })

  describe('monthScrollDensity - regression tests for cloud sync', () => {
    it('returns 60 by default', () => {
      expect(getMonthScrollDensity()).toBe(60)
    })

    it('returns the set value', () => {
      setMonthScrollDensity(80)
      expect(getMonthScrollDensity()).toBe(80)
    })

    it('can be set to 0', () => {
      setMonthScrollDensity(0)
      expect(getMonthScrollDensity()).toBe(0)
    })

    it('can be set to 100', () => {
      setMonthScrollDensity(100)
      expect(getMonthScrollDensity()).toBe(100)
    })

    it('persists value in memory between get calls', () => {
      setMonthScrollDensity(70)
      expect(getMonthScrollDensity()).toBe(70)
      expect(getMonthScrollDensity()).toBe(70) // Same value on subsequent call
    })
  })
})
